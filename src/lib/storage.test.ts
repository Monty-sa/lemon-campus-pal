import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, type ExplorerFilters } from "./explorer-filters";
import type { SchedulePlan } from "./schema";
import {
  FILTERS_STORAGE_KEY,
  GUEST_STORAGE_KEY,
  PLANS_OWNER_STORAGE_KEY,
  loadGuestPlans,
  loadInitialGuestPlans,
  loadPlans,
  loadSavedCategory,
  loadSavedFilters,
  loadSavedViewMode,
  saveGuestPlans,
  savePlans,
  saveSavedCategory,
  saveSavedFilters,
  saveSavedViewMode,
  saveUserPlans,
  loadUserPlans,
  saveActivePlanId,
  loadActivePlanId,
  clearGuestStorage,
  exportGuestBackup,
  STORAGE_KEY,
  VIEW_MODE_STORAGE_KEY,
} from "./storage";

const plans: SchedulePlan[] = ["First plan", "Second plan"].map((name, index) => ({
  id: `p${index}`,
  name,
  termId: "144820",
  sectionIds: index ? ["s1"] : [],
  createdAt: "2026-11-07T00:00:00.000Z",
  updatedAt: "2026-11-07T00:00:00.000Z",
}));

describe("plan and preferences persistence (MANDATORY GUEST-FIRST POLICY)", () => {
  it("round-trips multiple plans", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    savePlans(storage, plans);
    expect(loadPlans(storage)).toEqual(plans);
    expect(values.has(STORAGE_KEY)).toBe(true);
  });

  it("fails safely for corrupt local data", () => {
    expect(loadPlans({ getItem: () => "not-json" })).toEqual([]);
  });

  it("safely round-trips guest plans independently", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    saveGuestPlans(storage, plans);
    expect(loadGuestPlans(storage)).toEqual(plans);
    expect(values.has(GUEST_STORAGE_KEY)).toBe(true);
  });

  it("does not render a prior account's cached plans before identity verification", () => {
    const values = new Map<string, string>([
      [STORAGE_KEY, JSON.stringify(plans)],
      [PLANS_OWNER_STORAGE_KEY, "user:account-a"],
    ]);
    const storage = { getItem: (key: string) => values.get(key) ?? null };
    expect(loadInitialGuestPlans(storage, "144820")).toEqual([]);
    values.set(GUEST_STORAGE_KEY, JSON.stringify([plans[0]]));
    expect(loadInitialGuestPlans(storage, "144820")).toEqual([plans[0]]);
  });

  it("handles storage write exceptions (e.g. QuotaExceededError or private browsing restrictions) gracefully", () => {
    const throwingStorage = {
      setItem: () => {
        throw new Error("QuotaExceededError: storage is full");
      },
    };
    // Should not throw or crash
    expect(() => savePlans(throwingStorage, plans)).not.toThrow();
    expect(() => saveGuestPlans(throwingStorage, plans)).not.toThrow();
    expect(() => saveSavedFilters(throwingStorage, DEFAULT_FILTERS)).not.toThrow();
  });

  it("handles storage read exceptions gracefully", () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error("SecurityError: access denied");
      },
    };
    expect(loadPlans(throwingStorage)).toEqual([]);
    expect(loadGuestPlans(throwingStorage)).toEqual([]);
    expect(loadSavedFilters(throwingStorage)).toBeNull();
  });

  it("round-trips explorer filter preferences in guest storage", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };

    const filters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      departmentId: "0602",
      selectedDays: ["mon", "wed"],
      dayMode: "avoid",
    };

    saveSavedFilters(storage, filters);
    expect(values.has(FILTERS_STORAGE_KEY)).toBe(true);

    const loaded = loadSavedFilters(storage);
    expect(loaded?.departmentId).toBe("0602");
    expect(loaded?.selectedDays).toEqual(["mon", "wed"]);
    expect(loaded?.dayMode).toBe("avoid");
  });

  it("round-trips student category preference in guest storage (LEMON-011B)", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };

    saveSavedCategory(storage, "12");
    expect(loadSavedCategory(storage)).toBe("12");

    saveSavedCategory(storage, "11");
    expect(loadSavedCategory(storage)).toBe("11");
  });

  it("round-trips explorer view mode preference in guest storage (LEMON-011C)", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };

    expect(loadSavedViewMode(storage)).toBe("cards"); // default fallback

    saveSavedViewMode(storage, "table");
    expect(loadSavedViewMode(storage)).toBe("table");
    expect(values.get(VIEW_MODE_STORAGE_KEY)).toBe("table");

    saveSavedViewMode(storage, "cards");
    expect(loadSavedViewMode(storage)).toBe("cards");
  });

  it("strictly isolates user-scoped plans and active plans from guest data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    const userAPlans = [plans[0]];
    const userBPlans = [plans[1]];

    // Save User A plans
    saveUserPlans(storage, "user-a", userAPlans);
    saveActivePlanId(storage, "p0", "user-a");

    // Save User B plans
    saveUserPlans(storage, "user-b", userBPlans);
    saveActivePlanId(storage, "p1", "user-b");

    // User A cannot see User B's plans
    expect(loadUserPlans(storage, "user-a")).toEqual(userAPlans);
    expect(loadActivePlanId(storage, "user-a")).toBe("p0");

    // User B cannot see User A's plans
    expect(loadUserPlans(storage, "user-b")).toEqual(userBPlans);
    expect(loadActivePlanId(storage, "user-b")).toBe("p1");

    // Guest plans remain isolated
    expect(loadGuestPlans(storage)).toEqual([]);
    expect(loadActivePlanId(storage, null)).toBeNull();
  });

  it("clears guest storage safely while protecting user-owned cloud cached data", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    saveGuestPlans(storage, plans);
    saveActivePlanId(storage, "p0", null);
    saveUserPlans(storage, "user-a", [plans[1]]);

    const backup = exportGuestBackup(storage);
    expect(backup.plans).toEqual(plans);
    expect(backup.activePlanId).toBe("p0");

    clearGuestStorage(storage);
    expect(loadGuestPlans(storage)).toEqual([]);
    expect(loadActivePlanId(storage, null)).toBeNull();

    // User A's cached plans are untouched
    expect(loadUserPlans(storage, "user-a")).toEqual([plans[1]]);
  });
});
