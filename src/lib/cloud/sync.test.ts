import { describe, expect, it, vi } from "vitest";
import type { SchedulePlan } from "../schema";
import { GUEST_STORAGE_KEY, loadGuestPlans, loadPlans, loadUserPlans, STORAGE_KEY } from "../storage";
import {
  importGuestPlansToAccount,
  restoreGuestPlansOnLogout,
  syncPlansOnLogin,
} from "./sync";
import type { CloudScheduleStore } from "./schedules";

function makePlan(id: string, name: string, updatedAt = "2026-11-07T00:00:00.000Z"): SchedulePlan {
  return {
    id,
    name,
    termId: "144820",
    sectionIds: ["s1"],
    createdAt: "2026-11-07T00:00:00.000Z",
    updatedAt,
  };
}

function makeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => store.set(key, value)),
    removeItem: vi.fn((key: string) => store.delete(key)),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(),
    length: 0,
  } as unknown as Storage;
}

describe("syncPlansOnLogin (STRICT PRIVACY & ISOLATION POLICY)", () => {
  it("keeps pending local edits when the verified user already owns the cache", async () => {
    const storage = makeStorage();
    const guest = makePlan("guest", "Original guest plan");
    const pending = makePlan("pending", "Account A pending edit");
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify([guest]));
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");
    const store = { list: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue(undefined), remove: vi.fn() };

    const result = await syncPlansOnLogin(store, storage, [pending], "account-a");

    expect(store.upsert).toHaveBeenCalledWith([pending]);
    expect(result.mergedPlans).toEqual([pending]);
    expect(loadGuestPlans(storage)).toEqual([guest]);
  });

  it("never migrates cached plans from a different signed-in account and never auto-merges guest data without consent", async () => {
    const storage = makeStorage();
    const guest = makePlan("guest", "Guest plan");
    const otherAccount = makePlan("account-a", "Account A private plan");
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify([guest]));
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");
    storage.setItem(STORAGE_KEY, JSON.stringify([otherAccount]));
    const store = { list: vi.fn().mockResolvedValue([]), upsert: vi.fn().mockResolvedValue(undefined), remove: vi.fn() };

    // Account B logs in without explicit consent to import guest data
    const result = await syncPlansOnLogin(store, storage, [otherAccount], "account-b");

    // Must NOT upload otherAccount plans or guest plans silently
    expect(store.upsert).not.toHaveBeenCalled();
    expect(result.mergedPlans).not.toContainEqual(otherAccount);
    expect(result.hasUnimportedGuestPlans).toBe(true);
    // Guest plans remain intact in guest storage
    expect(loadGuestPlans(storage)).toEqual([guest]);
  });

  it("merges user cloud plans and leaves guest storage intact without silent upload", async () => {
    const storage = makeStorage();
    const guestPlans = [makePlan("p1", "Local Plan 1", "2026-11-07T02:00:00.000Z")];
    const cloudPlans = [
      makePlan("cloud-1", "Cloud Plan 1", "2026-11-07T01:00:00.000Z"),
      makePlan("cloud-2", "Cloud Plan 2", "2026-11-07T01:30:00.000Z"),
    ];

    const store: CloudScheduleStore = {
      list: vi.fn().mockResolvedValue(cloudPlans),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    // Login without consent does not upload guest plans
    const result = await syncPlansOnLogin(store, storage, guestPlans, "account-a");

    expect(loadGuestPlans(storage)).toEqual(guestPlans);
    expect(store.upsert).not.toHaveBeenCalled();
    expect(result.mergedPlans).toEqual(cloudPlans);
    expect(result.hasUnimportedGuestPlans).toBe(true);
  });

  it("allows explicit consent-driven guest plan import and resolves duplicate names safely", async () => {
    const storage = makeStorage();
    const guestPlans = [makePlan("g1", "My Plan")];
    const userPlans = [makePlan("u1", "My Plan")];
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestPlans));
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");

    const store: CloudScheduleStore = {
      list: vi.fn().mockResolvedValue(userPlans),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const importResult = await importGuestPlansToAccount(
      store,
      storage,
      "account-a",
      userPlans,
      guestPlans,
    );

    expect(importResult.upsertedCount).toBe(1);
    expect(store.upsert).toHaveBeenCalled();
    expect(importResult.mergedPlans).toHaveLength(2);
    // Duplicate name is resolved
    expect(importResult.mergedPlans[1].name).toBe("My Plan (Imported)");
    // Original guest plans are preserved in guest storage
    expect(loadGuestPlans(storage)).toEqual(guestPlans);
  });

  it("replaces a single empty placeholder plan upon guest import so imported plan is immediately active", async () => {
    const storage = makeStorage();
    const guestPlans = [makePlan("g1", "Guest Schedule", "2026-11-07T00:00:00.000Z")];
    const emptyPlaceholder: SchedulePlan = {
      id: "empty-1",
      name: "My Plan 1",
      termId: "144820",
      sectionIds: [],
      createdAt: "2026-11-07T00:00:00.000Z",
      updatedAt: "2026-11-07T00:00:00.000Z",
    };
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestPlans));
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");

    const store: CloudScheduleStore = {
      list: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const importResult = await importGuestPlansToAccount(
      store,
      storage,
      "account-a",
      [emptyPlaceholder],
      guestPlans,
    );

    expect(importResult.mergedPlans).toHaveLength(1);
    expect(importResult.mergedPlans[0].name).toBe("Guest Schedule");
    expect(importResult.mergedPlans[0].sectionIds).toEqual(["s1"]);
  });

  it("handles empty cloud plans when the user already owned local edits without data loss", async () => {
    const storage = makeStorage();
    const localPlans = [makePlan("p1", "First"), makePlan("p2", "Second")];
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");

    const store: CloudScheduleStore = {
      list: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    };

    const result = await syncPlansOnLogin(store, storage, localPlans, "account-a");

    expect(result.upsertedCount).toBe(2);
    expect(store.upsert).toHaveBeenCalledWith(localPlans);
    expect(loadPlans(storage)).toEqual(localPlans);
  });

  it("does not relabel prior identity data when cloud sync fails", async () => {
    const storage = makeStorage();
    const accountA = makePlan("account-a-plan", "Account A private plan");
    const accountB = makePlan("account-b-plan", "Account B cached plan");
    storage.setItem(STORAGE_KEY, JSON.stringify([accountA]));
    storage.setItem("lemon.schedule-plans-owner.v1", "user:account-a");
    storage.setItem("lemon.user.account-b.plans.v1", JSON.stringify([accountB]));
    const store: CloudScheduleStore = {
      list: vi.fn().mockRejectedValue(new Error("network unavailable")),
      upsert: vi.fn(),
      remove: vi.fn(),
    };

    await expect(syncPlansOnLogin(store, storage, [accountA], "account-b")).rejects.toThrow(/network unavailable/i);

    expect(loadUserPlans(storage, "account-b")).toEqual([accountB]);
    expect(loadPlans(storage)).toEqual([accountA]);
    expect(storage.getItem("lemon.schedule-plans-owner.v1")).toBe("user:account-a");
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it("preserves the guest identity through guest to account A to logout to guest", async () => {
    const storage = makeStorage();
    const guest = makePlan("guest-plan", "Guest private plan");
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify([guest]));
    storage.setItem(STORAGE_KEY, JSON.stringify([guest]));
    storage.setItem("lemon.schedule-plans-owner.v1", "guest");
    const store: CloudScheduleStore = {
      list: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    };

    const login = await syncPlansOnLogin(store, storage, [guest], "account-a");
    expect(login.mergedPlans).toEqual([]);
    expect(store.upsert).not.toHaveBeenCalled();
    expect(loadGuestPlans(storage)).toEqual([guest]);

    const restored = restoreGuestPlansOnLogout(storage, makePlan("fallback", "Fallback"));
    expect(restored).toEqual([guest]);
    expect(loadPlans(storage)).toEqual([guest]);
    expect(storage.getItem("lemon.schedule-plans-owner.v1")).toBe("guest");
  });
});

describe("restoreGuestPlansOnLogout", () => {
  it("restores original guest plans and leaves them unharmed", () => {
    const storage = makeStorage();
    const guestPlans = [makePlan("guest-1", "Original Guest Plan")];
    storage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestPlans));
    storage.setItem(STORAGE_KEY, JSON.stringify([makePlan("user-plan", "Logged In Plan")]));

    const restored = restoreGuestPlansOnLogout(storage, makePlan("fallback", "Fallback"));

    expect(restored).toEqual(guestPlans);
    expect(loadPlans(storage)).toEqual(guestPlans);
  });

  it("uses fallback plan when no guest plans were previously saved", () => {
    const storage = makeStorage();
    const fallback = makePlan("fallback", "Default Plan");

    const restored = restoreGuestPlansOnLogout(storage, fallback);

    expect(restored).toEqual([fallback]);
    expect(loadPlans(storage)).toEqual([fallback]);
  });
});
