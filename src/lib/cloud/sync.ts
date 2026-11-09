import type { SchedulePlan } from "../schema";
import {
  GUEST_STORAGE_KEY,
  PLANS_OWNER_STORAGE_KEY,
  loadGuestPlans,
  loadUserPlans,
  loadPendingPlanSyncRecords,
  removePendingPlanSyncRecord,
  saveGuestPlans,
  savePlans,
  saveUserPlans,
} from "../storage";
import { CLOUD_SCHEDULE_LIMITS, planCloudMigration, type CloudScheduleStore } from "./schedules";

export type SyncResult = {
  mergedPlans: SchedulePlan[];
  upsertedCount: number;
  hasUnimportedGuestPlans?: boolean;
};

export interface SyncLoginOptions {
  /**
   * Only true when the user has explicitly clicked to import guest plans into their account.
   * Default is false to strictly isolate guest data from cloud accounts.
   */
  importGuestConsent?: boolean;
}

/**
 * Runs identity-scoped synchronization when an authenticated session is established.
 *
 * PRIVACY GUARANTEES:
 * 1. Snapshots guest plans into guest storage if not already preserved so guest plans are never lost.
 * 2. Fetches cloud plans for the verified user.
 * 3. Never carries User A's plans into User B's session.
 * 4. Never automatically merges guest plans into cloud account without explicit consent.
 * 5. Loads ONLY the verified user's cloud plans and local edits.
 */
export async function syncPlansOnLogin(
  store: CloudScheduleStore,
  storage: Storage,
  currentLocalPlans: readonly SchedulePlan[],
  verifiedUserId: string,
  options: SyncLoginOptions = {},
): Promise<SyncResult> {
  // Snapshot guest plans before switching context if not already preserved
  const existingGuest = loadGuestPlans(storage);
  const hasGuestSnapshot = storage.getItem(GUEST_STORAGE_KEY) !== null;
  const previousOwner = storage.getItem(PLANS_OWNER_STORAGE_KEY);

  const localGuestPlans = hasGuestSnapshot
    ? existingGuest
    : previousOwner?.startsWith("user:")
    ? []
    : [...currentLocalPlans];

  if (!hasGuestSnapshot && localGuestPlans.length > 0) {
    saveGuestPlans(storage, localGuestPlans);
  }

  // Determine local plans belonging strictly to this verified user
  let userOwnedLocalPlans: SchedulePlan[] = [];
  if (previousOwner === `user:${verifiedUserId}`) {
    // Current in-memory plans belong to this exact verified user (e.g. pending offline edits)
    userOwnedLocalPlans = [...currentLocalPlans];
  } else {
    // Load from user-scoped storage cache if previously saved on this device
    userOwnedLocalPlans = loadUserPlans(storage, verifiedUserId);
  }

  // If explicit consent is granted to import guest plans on login
  if (options.importGuestConsent && localGuestPlans.length > 0) {
    const importedGuest = resolveDuplicatePlanNames(localGuestPlans, userOwnedLocalPlans);
    userOwnedLocalPlans = [...userOwnedLocalPlans, ...importedGuest];
  }

  // Fetch cloud rows for the verified user
  const cloudPlans = await store.list();

  // Pure migration calculation
  const migration = planCloudMigration(
    userOwnedLocalPlans,
    cloudPlans.map((p) => ({
      user_id: "00000000-0000-0000-0000-000000000000", // placeholder for mapper, store manages actual user_id
      id: p.id,
      name: p.name,
      term_id: p.termId,
      section_ids: p.sectionIds,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    })),
    "merge",
  );

  // A pending local write is an explicit user action (including clearing a plan),
  // so it must win over stale cloud timestamps until the cloud acknowledges it.
  const pendingPlanWrites = loadPendingPlanSyncRecords(storage, verifiedUserId);
  const plansById = new Map(migration.plans.map((plan) => [plan.id, plan]));
  const upsertsById = new Map(migration.upserts.map((plan) => [plan.id, plan]));
  for (const pending of pendingPlanWrites) {
    plansById.set(pending.plan.id, pending.plan);
    upsertsById.set(pending.plan.id, pending.plan);
  }
  const mergedPlans = [...plansById.values()];
  const upserts = [...upsertsById.values()];
  if (mergedPlans.length > CLOUD_SCHEDULE_LIMITS.maxPlans) {
    throw new Error(`Pending schedule sync would exceed the ${CLOUD_SCHEDULE_LIMITS.maxPlans}-plan limit. Local plans were kept.`);
  }

  // Cloud writes must succeed before updating authoritative local storage
  if (upserts.length > 0) {
    await store.upsert(upserts);
  }

  for (const pending of pendingPlanWrites) {
    removePendingPlanSyncRecord(storage, verifiedUserId, pending.plan.id, pending.operationId);
  }

  // Update user-scoped cache and active storage
  saveUserPlans(storage, verifiedUserId, mergedPlans);
  savePlans(storage, mergedPlans);
  storage.setItem(PLANS_OWNER_STORAGE_KEY, `user:${verifiedUserId}`);

  const hasUnimportedGuest =
    !options.importGuestConsent &&
    localGuestPlans.some((p) => p.sectionIds && p.sectionIds.length > 0);

  return {
    mergedPlans,
    upsertedCount: upserts.length,
    hasUnimportedGuestPlans: hasUnimportedGuest,
  };
}

/**
 * Explicitly imports guest plans into the authenticated user's account upon user request.
 * Resolves duplicate names safely (e.g. "Plan 1 (Imported)") and assigns fresh IDs.
 */
export async function importGuestPlansToAccount(
  store: CloudScheduleStore,
  storage: Storage,
  verifiedUserId: string,
  existingUserPlans: readonly SchedulePlan[],
  guestPlansToImport?: readonly SchedulePlan[],
): Promise<SyncResult> {
  const guestPlans = guestPlansToImport ?? loadGuestPlans(storage);
  if (!guestPlans.length) {
    return {
      mergedPlans: [...existingUserPlans],
      upsertedCount: 0,
      hasUnimportedGuestPlans: false,
    };
  }

  // Assign fresh IDs and rename duplicates safely
  const resolvedGuestPlans: SchedulePlan[] = resolveDuplicatePlanNames(guestPlans, existingUserPlans).map((p, idx) => ({
    ...p,
    id: `imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: new Date().toISOString(),
  }));

  const isDefaultEmptyPlaceholder =
    existingUserPlans.length === 1 &&
    existingUserPlans[0].sectionIds.length === 0;

  const combinedPlans = isDefaultEmptyPlaceholder
    ? [...resolvedGuestPlans]
    : [...existingUserPlans, ...resolvedGuestPlans];

  // Upsert the newly imported plans to cloud
  await store.upsert(resolvedGuestPlans);

  // Update local storage
  saveUserPlans(storage, verifiedUserId, combinedPlans);
  savePlans(storage, combinedPlans);
  storage.setItem(PLANS_OWNER_STORAGE_KEY, `user:${verifiedUserId}`);

  return {
    mergedPlans: combinedPlans,
    upsertedCount: resolvedGuestPlans.length,
    hasUnimportedGuestPlans: false,
  };
}

function resolveDuplicatePlanNames(
  incomingPlans: readonly SchedulePlan[],
  existingPlans: readonly SchedulePlan[],
): SchedulePlan[] {
  const existingNames = new Set(existingPlans.map((p) => p.name.trim().toLowerCase()));

  return incomingPlans.map((plan) => {
    let name = plan.name;
    if (existingNames.has(name.trim().toLowerCase())) {
      name = `${plan.name} (Imported)`;
    }
    existingNames.add(name.trim().toLowerCase());
    return {
      ...plan,
      name,
    };
  });
}

/**
 * Restores guest plans upon logout without deleting or corrupting them.
 */
export function restoreGuestPlansOnLogout(
  storage: Storage,
  fallbackPlan: SchedulePlan,
): SchedulePlan[] {
  const guestPlans = loadGuestPlans(storage);
  const plansToRestore = guestPlans.length > 0 ? guestPlans : [fallbackPlan];
  savePlans(storage, plansToRestore);
  storage.setItem(PLANS_OWNER_STORAGE_KEY, "guest");
  return plansToRestore;
}
