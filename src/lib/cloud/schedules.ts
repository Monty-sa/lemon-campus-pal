import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchedulePlan } from "../schema";

/**
 * Row limits are intentionally conservative. They keep a single account from
 * using schedule storage as arbitrary file storage and keep sync responses small.
 */
export const CLOUD_SCHEDULE_LIMITS = Object.freeze({
  maxPlans: 100,
  maxNameLength: 120,
  maxPlanIdLength: 128,
  maxTermIdLength: 64,
  maxSectionIdLength: 128,
  maxSectionsPerPlan: 100,
});

const PlanIdSchema = z
  .string()
  .min(1)
  .max(CLOUD_SCHEDULE_LIMITS.maxPlanIdLength)
  .refine((value) => value.trim().length > 0, "Plan ID must not be blank");

const PlanNameSchema = z
  .string()
  .min(1)
  .max(CLOUD_SCHEDULE_LIMITS.maxNameLength)
  .refine((value) => value.trim().length > 0, "Plan name must not be blank");

const TermIdSchema = z
  .string()
  .min(1)
  .max(CLOUD_SCHEDULE_LIMITS.maxTermIdLength)
  .refine((value) => value.trim().length > 0, "Term ID must not be blank");

const SectionIdSchema = z
  .string()
  .min(1)
  .max(CLOUD_SCHEDULE_LIMITS.maxSectionIdLength)
  .refine((value) => value.trim().length > 0, "Section ID must not be blank");

const TimestamptzSchema = z.string().datetime({ offset: true });

/** Validates a plan before it is written to the private cloud table. */
export const CloudPlanSchema = z
  .object({
    id: PlanIdSchema,
    name: PlanNameSchema,
    termId: TermIdSchema,
    sectionIds: z
      .array(SectionIdSchema)
      .max(CLOUD_SCHEDULE_LIMITS.maxSectionsPerPlan)
      .refine((ids) => new Set(ids).size === ids.length, "Section IDs must be unique within a plan"),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine((plan) => Date.parse(plan.updatedAt) >= Date.parse(plan.createdAt), {
    message: "updatedAt must not be earlier than createdAt",
    path: ["updatedAt"],
  });

export type CloudPlan = z.infer<typeof CloudPlanSchema>;

/** Shape returned by PostgREST for public.schedules. */
export const CloudScheduleRowSchema = z.object({
  user_id: z.string().uuid(),
  id: PlanIdSchema,
  name: PlanNameSchema,
  term_id: TermIdSchema,
  section_ids: z.array(SectionIdSchema).max(CLOUD_SCHEDULE_LIMITS.maxSectionsPerPlan),
  created_at: TimestamptzSchema,
  updated_at: TimestamptzSchema,
});

export type CloudScheduleRow = z.infer<typeof CloudScheduleRowSchema>;

/** Columns the browser is allowed to send. Timestamps are database-controlled. */
export const CloudScheduleInsertSchema = z.object({
  user_id: z.string().uuid(),
  id: PlanIdSchema,
  name: PlanNameSchema,
  term_id: TermIdSchema,
  section_ids: z
    .array(SectionIdSchema)
    .max(CLOUD_SCHEDULE_LIMITS.maxSectionsPerPlan)
    .refine((ids) => new Set(ids).size === ids.length, "Section IDs must be unique within a plan"),
}).strict();

export type CloudScheduleInsert = z.infer<typeof CloudScheduleInsertSchema>;

export const CloudScheduleRowsSchema = z
  .array(CloudScheduleRowSchema)
  .max(CLOUD_SCHEDULE_LIMITS.maxPlans);

export function toCloudScheduleInsert(plan: SchedulePlan, userId: string): CloudScheduleInsert {
  const parsed = CloudPlanSchema.parse(plan);
  return CloudScheduleInsertSchema.parse({
    user_id: userId,
    id: parsed.id,
    name: parsed.name,
    term_id: parsed.termId,
    section_ids: parsed.sectionIds,
  });
}

export function cloudRowToPlan(row: CloudScheduleRow): SchedulePlan {
  const parsed = CloudScheduleRowSchema.parse(row);
  return CloudPlanSchema.parse({
    id: parsed.id,
    name: parsed.name,
    termId: parsed.term_id,
    sectionIds: parsed.section_ids,
    createdAt: new Date(parsed.created_at).toISOString(),
    updatedAt: new Date(parsed.updated_at).toISOString(),
  });
}

export function cloudRowsToPlans(rows: readonly CloudScheduleRow[]): SchedulePlan[] {
  return CloudScheduleRowsSchema.parse(rows).map(cloudRowToPlan);
}

export type CloudMigrationMode = "merge" | "replace";

export type CloudMigrationPlan = {
  mode: CloudMigrationMode;
  /** The authoritative local list after migration. Keep this only after cloud writes succeed. */
  plans: SchedulePlan[];
  /** Idempotent upserts to send to the cloud. */
  upserts: SchedulePlan[];
  /** Cloud-only plan IDs to remove. Always empty for merge mode. */
  deletes: string[];
};

function dedupeLocalPlans(plans: readonly SchedulePlan[]): SchedulePlan[] {
  const result: SchedulePlan[] = [];
  const indexById = new Map<string, number>();

  for (const candidate of plans) {
    const plan = CloudPlanSchema.parse(candidate);
    const existingIndex = indexById.get(plan.id);
    if (existingIndex === undefined) {
      indexById.set(plan.id, result.length);
      result.push(plan);
      continue;
    }
    if (Date.parse(plan.updatedAt) > Date.parse(result[existingIndex].updatedAt)) {
      result[existingIndex] = plan;
    }
  }

  return result;
}

function samePlanContent(left: SchedulePlan, right: SchedulePlan): boolean {
  return (
    left.name === right.name &&
    left.termId === right.termId &&
    left.sectionIds.length === right.sectionIds.length &&
    left.sectionIds.every((sectionId, index) => sectionId === right.sectionIds[index])
  );
}

function assertPlanLimit(count: number): void {
  if (count > CLOUD_SCHEDULE_LIMITS.maxPlans) {
    throw new Error(
      `Cloud migration would keep ${count} plans, which exceeds the ${CLOUD_SCHEDULE_LIMITS.maxPlans}-plan limit. Remove plans before syncing.`,
    );
  }
}

/**
 * Plans a local-to-cloud migration.
 *
 * - `merge` (default) is non-destructive: local-only plans are kept, cloud-only
 *   plans are kept, and the newest `updatedAt` wins for duplicate IDs.
 * - `replace` is explicit and destructive: local plans overwrite the cloud set
 *   and cloud-only plan IDs are returned in `deletes`.
 *
 * The caller must not discard local plans until `upserts` and `deletes` have
 * completed successfully.
 */
export function planCloudMigration(
  localPlans: readonly SchedulePlan[],
  cloudRows: readonly CloudScheduleRow[],
  mode: CloudMigrationMode = "merge",
): CloudMigrationPlan {
  if (mode !== "merge" && mode !== "replace") {
    throw new Error(`Unsupported cloud migration mode: ${String(mode)}`);
  }

  const local = dedupeLocalPlans(localPlans);
  const cloudPlans = cloudRowsToPlans(cloudRows);
  const cloudById = new Map<string, SchedulePlan>();

  for (const plan of cloudPlans) {
    if (cloudById.has(plan.id)) {
      throw new Error(`Cloud data contains a duplicate plan ID: ${plan.id}`);
    }
    cloudById.set(plan.id, plan);
  }

  if (mode === "replace") {
    assertPlanLimit(local.length);
    const localIds = new Set(local.map((plan) => plan.id));
    return {
      mode,
      plans: local,
      upserts: local,
      deletes: cloudPlans.filter((plan) => !localIds.has(plan.id)).map((plan) => plan.id),
    };
  }

  const localIds = new Set(local.map((plan) => plan.id));
  const plans: SchedulePlan[] = [];
  const upserts: SchedulePlan[] = [];

  for (const localPlan of local) {
    const cloudPlan = cloudById.get(localPlan.id);
    if (!cloudPlan) {
      plans.push(localPlan);
      upserts.push(localPlan);
      continue;
    }

    const localTime = Date.parse(localPlan.updatedAt);
    const cloudTime = Date.parse(cloudPlan.updatedAt);
    const localWins = localTime > cloudTime || (localTime === cloudTime && !samePlanContent(localPlan, cloudPlan));

    plans.push(localWins ? localPlan : cloudPlan);
    if (localWins) upserts.push(localPlan);
  }

  for (const cloudPlan of cloudPlans) {
    if (!localIds.has(cloudPlan.id)) plans.push(cloudPlan);
  }

  assertPlanLimit(plans.length);

  return { mode, plans, upserts, deletes: [] };
}

/**
 * Session-bound storage contract. Implementations must derive the user ID from
 * the verified server session, never from a caller-supplied user ID.
 */
export interface CloudScheduleStore {
  list(): Promise<SchedulePlan[]>;
  upsert(plans: readonly SchedulePlan[]): Promise<void>;
  remove(planIds: readonly string[]): Promise<void>;
}

export class SupabaseScheduleStore implements CloudScheduleStore {
  constructor(private readonly supabase: SupabaseClient) {}

  private async getVerifiedUserId(): Promise<string> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("User must be authenticated to access cloud schedules.");
    }
    return data.user.id;
  }

  async list(): Promise<SchedulePlan[]> {
    const userId = await this.getVerifiedUserId();
    const { data, error } = await this.supabase
      .from("schedules")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load cloud schedules: ${error.message}`);
    }
    return cloudRowsToPlans((data ?? []) as CloudScheduleRow[]);
  }

  async upsert(plans: readonly SchedulePlan[]): Promise<void> {
    if (plans.length === 0) return;
    const userId = await this.getVerifiedUserId();
    const rows = plans.map((plan) => toCloudScheduleInsert(plan, userId));
    const { error } = await this.supabase
      .from("schedules")
      .upsert(rows, { onConflict: "user_id,id" });

    if (error) {
      throw new Error(`Failed to save cloud schedules: ${error.message}`);
    }
  }

  async remove(planIds: readonly string[]): Promise<void> {
    if (planIds.length === 0) return;
    const userId = await this.getVerifiedUserId();
    const { error } = await this.supabase
      .from("schedules")
      .delete()
      .eq("user_id", userId)
      .in("id", planIds);

    if (error) {
      throw new Error(`Failed to delete cloud schedules: ${error.message}`);
    }
  }
}
