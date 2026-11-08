import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchedulePlan } from "../schema";
import {
  CLOUD_SCHEDULE_LIMITS,
  CloudPlanSchema,
  CloudScheduleInsertSchema,
  cloudRowToPlan,
  cloudRowsToPlans,
  planCloudMigration,
  SupabaseScheduleStore,
  toCloudScheduleInsert,
  type CloudScheduleRow,
} from "./schedules";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function plan(overrides: Partial<SchedulePlan> = {}): SchedulePlan {
  return {
    id: "plan-1",
    name: "My plan",
    termId: "144820",
    sectionIds: ["144820:63953", "144820:85169"],
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt: "2026-11-07T00:00:00.000Z",
    ...overrides,
  };
}

function row(overrides: Partial<CloudScheduleRow> = {}): CloudScheduleRow {
  return {
    user_id: USER_ID,
    id: "plan-1",
    name: "My plan",
    term_id: "144820",
    section_ids: ["144820:63953", "144820:85169"],
    created_at: "2026-11-07T00:00:00+00:00",
    updated_at: "2026-11-07T00:00:00+00:00",
    ...overrides,
  };
}

describe("cloud schedule validation", () => {
  it("accepts a normal plan and rejects unsafe shapes", () => {
    expect(CloudPlanSchema.parse(plan()).name).toBe("My plan");
    expect(() => CloudPlanSchema.parse(plan({ name: "   " }))).toThrow();
    expect(() => CloudPlanSchema.parse(plan({ name: "x".repeat(CLOUD_SCHEDULE_LIMITS.maxNameLength + 1) }))).toThrow();
    expect(() => CloudPlanSchema.parse(plan({ sectionIds: ["a", "a"] }))).toThrow(/unique/i);
    expect(() =>
      CloudPlanSchema.parse(plan({ sectionIds: Array.from({ length: CLOUD_SCHEDULE_LIMITS.maxSectionsPerPlan + 1 }, (_, i) => `s${i}`) })),
    ).toThrow();
    expect(() => CloudPlanSchema.parse(plan({ updatedAt: "2026-11-06T23:59:59.000Z" }))).toThrow(/updatedAt/i);
  });

  it("maps plans to insert payloads without client-controlled timestamps", () => {
    const insert = toCloudScheduleInsert(plan(), USER_ID);
    expect(insert).toEqual({
      user_id: USER_ID,
      id: "plan-1",
      name: "My plan",
      term_id: "144820",
      section_ids: ["144820:63953", "144820:85169"],
    });
    expect(CloudScheduleInsertSchema.safeParse({ ...insert, created_at: "2020-01-01T00:00:00Z" }).success).toBe(false);
  });

  it("maps PostgREST rows back to domain plans with ISO timestamps", () => {
    expect(cloudRowToPlan(row())).toEqual(plan());
    expect(cloudRowsToPlans([row()])).toEqual([plan()]);
  });

  it("rejects invalid user IDs and malformed rows", () => {
    expect(() => toCloudScheduleInsert(plan(), "not-a-uuid")).toThrow();
    expect(() => cloudRowToPlan(row({ user_id: "not-a-uuid" }))).toThrow();
    expect(() => cloudRowToPlan(row({ updated_at: "yesterday" }))).toThrow();
  });
});

describe("local-to-cloud migration", () => {
  it("merges local-only, cloud-only, and duplicate plans", () => {
    const local = [
      plan({ id: "local-only", name: "Local only" }),
      plan({ id: "shared", name: "Local edit", updatedAt: "2026-11-07T02:00:00.000Z" }),
      plan({ id: "cloud-wins", name: "Stale local", updatedAt: "2026-11-07T01:00:00.000Z" }),
    ];
    const cloud = [
      row({ id: "shared", name: "Old cloud", updated_at: "2026-11-07T01:00:00+00:00" }),
      row({ id: "cloud-wins", name: "New cloud", updated_at: "2026-11-07T03:00:00+00:00" }),
      row({ id: "cloud-only", name: "Cloud only" }),
    ];

    const result = planCloudMigration(local, cloud);

    expect(result.mode).toBe("merge");
    expect(result.deletes).toEqual([]);
    expect(result.plans.map((item) => [item.id, item.name])).toEqual([
      ["local-only", "Local only"],
      ["shared", "Local edit"],
      ["cloud-wins", "New cloud"],
      ["cloud-only", "Cloud only"],
    ]);
    expect(result.upserts.map((item) => item.id)).toEqual(["local-only", "shared"]);
  });

  it("uses local content when timestamps tie but data differs", () => {
    const local = [plan({ name: "Local name" })];
    const cloud = [row({ name: "Cloud name" })];
    const result = planCloudMigration(local, cloud);
    expect(result.plans[0].name).toBe("Local name");
    expect(result.upserts).toHaveLength(1);
  });

  it("keeps cloud data when timestamps tie and content matches", () => {
    const result = planCloudMigration([plan()], [row()]);
    expect(result.plans).toEqual([plan()]);
    expect(result.upserts).toEqual([]);
  });

  it("replaces the cloud set only when explicitly requested", () => {
    const local = [plan({ id: "plan-1" }), plan({ id: "plan-2" })];
    const cloud = [row({ id: "plan-1" }), row({ id: "cloud-only" })];

    const result = planCloudMigration(local, cloud, "replace");

    expect(result.mode).toBe("replace");
    expect(result.plans.map((item) => item.id)).toEqual(["plan-1", "plan-2"]);
    expect(result.upserts.map((item) => item.id)).toEqual(["plan-1", "plan-2"]);
    expect(result.deletes).toEqual(["cloud-only"]);
  });

  it("deduplicates local plans by keeping the newest copy and preserving order", () => {
    const older = plan({ id: "same", name: "Older", updatedAt: "2026-11-07T01:00:00.000Z" });
    const newer = plan({ id: "same", name: "Newer", updatedAt: "2026-11-07T02:00:00.000Z" });

    const result = planCloudMigration([older, plan({ id: "other" }), newer], []);

    expect(result.plans.map((item) => [item.id, item.name])).toEqual([
      ["same", "Newer"],
      ["other", "My plan"],
    ]);
  });

  it("refuses to exceed the plan limit instead of dropping data", () => {
    const local = Array.from({ length: CLOUD_SCHEDULE_LIMITS.maxPlans }, (_, index) =>
      plan({ id: `local-${index}` }),
    );
    const cloud = [row({ id: "cloud-only" })];
    expect(() => planCloudMigration(local, cloud)).toThrow(/exceeds/i);
  });

  it("rejects duplicate cloud IDs from corrupt input", () => {
    expect(() => planCloudMigration([], [row(), row({ name: "Duplicate" })])).toThrow(/duplicate/i);
  });
});

describe("SupabaseScheduleStore", () => {
  function mockSupabase(userId: string | null = USER_ID) {
    const fromMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [row()],
        error: null,
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ error: null }),
    };

    return {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: userId ? { id: userId, email: "user@example.com" } : null },
          error: userId ? null : new Error("No session"),
        }),
      },
      from: vi.fn().mockReturnValue(fromMock),
      _fromMock: fromMock,
    } as unknown as SupabaseClient & { _fromMock: typeof fromMock };
  }

  it("requires a verified session and never accepts user IDs from caller", async () => {
    const unauthenticated = mockSupabase(null);
    const store = new SupabaseScheduleStore(unauthenticated);

    await expect(store.list()).rejects.toThrow(/authenticated/i);
    await expect(store.upsert([plan()])).rejects.toThrow(/authenticated/i);
    await expect(store.remove(["p1"])).rejects.toThrow(/authenticated/i);
  });

  it("lists schedules using the verified user ID", async () => {
    const client = mockSupabase(USER_ID);
    const store = new SupabaseScheduleStore(client);

    const plans = await store.list();
    expect(plans).toEqual([plan()]);
    expect(client.from).toHaveBeenCalledWith("schedules");
    expect(client._fromMock.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("upserts schedules without client timestamps and with onConflict constraint", async () => {
    const client = mockSupabase(USER_ID);
    const store = new SupabaseScheduleStore(client);

    await store.upsert([plan()]);
    expect(client.from).toHaveBeenCalledWith("schedules");
    expect(client._fromMock.upsert).toHaveBeenCalledWith(
      [
        {
          user_id: USER_ID,
          id: "plan-1",
          name: "My plan",
          term_id: "144820",
          section_ids: ["144820:63953", "144820:85169"],
        },
      ],
      { onConflict: "user_id,id" },
    );
  });

  it("deletes schedules by user_id and plan ID", async () => {
    const client = mockSupabase(USER_ID);
    const store = new SupabaseScheduleStore(client);

    await store.remove(["plan-1"]);
    expect(client.from).toHaveBeenCalledWith("schedules");
    expect(client._fromMock.delete).toHaveBeenCalled();
    expect(client._fromMock.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(client._fromMock.in).toHaveBeenCalledWith("id", ["plan-1"]);
  });
});
