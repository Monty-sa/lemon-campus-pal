import { z } from "zod";
import { SchedulePlanSchema, type SchedulePlan } from "./schema";
import type { ExplorerFilters } from "./explorer-filters";

export const STORAGE_KEY = "lemon.schedule-plans.v1";
export const GUEST_STORAGE_KEY = "lemon.guest-plans.v1";
export const GUEST_ACTIVE_PLAN_KEY = "lemon.guest.active-plan.v1";
export const GUEST_AUTO_SCHEDULE_KEY = "lemon.guest.auto-schedule-preferences.v1";
export const GUEST_GPA_DRAFT_KEY = "lemon.guest.gpa-draft.v1";
export const GUEST_GPA_SCENARIOS_KEY = "lemon.guest.gpa-scenarios.v1";
export const PLANS_OWNER_STORAGE_KEY = "lemon.schedule-plans-owner.v1";
export const FILTERS_STORAGE_KEY = "lemon.explorer-filters.v1";
export const CATEGORY_STORAGE_KEY = "lemon.selected-category.v1";
export const VIEW_MODE_STORAGE_KEY = "lemon.explorer-view.v1";

export type ExplorerViewMode = "cards" | "table";

const PlansSchema = z.array(SchedulePlanSchema);

export function getUserPlansKey(userId: string): string {
  return `lemon.user.${userId}.plans.v1`;
}

export function getUserActivePlanKey(userId: string): string {
  return `lemon.user.${userId}.active-plan.v1`;
}

export function getUserPreferencesKey(userId: string): string {
  return `lemon.user.${userId}.auto-schedule-preferences.v1`;
}

export function getUserGpaDraftKey(userId: string): string {
  return `lemon.user.${userId}.gpa-draft.v1`;
}

export function getUserGpaScenariosKey(userId: string): string {
  return `lemon.user.${userId}.gpa-scenarios.v1`;
}

export function getActiveGpaDraftKey(storage: Pick<Storage, "getItem">): string {
  const owner = storage.getItem(PLANS_OWNER_STORAGE_KEY);
  if (owner && owner.startsWith("user:")) {
    const userId = owner.slice(5);
    return getUserGpaDraftKey(userId);
  }
  return GUEST_GPA_DRAFT_KEY;
}

export function getActiveGpaScenariosKey(storage: Pick<Storage, "getItem">): string {
  const owner = storage.getItem(PLANS_OWNER_STORAGE_KEY);
  if (owner && owner.startsWith("user:")) {
    const userId = owner.slice(5);
    return getUserGpaScenariosKey(userId);
  }
  return GUEST_GPA_SCENARIOS_KEY;
}

export function loadPlans(storage: Pick<Storage, "getItem">, key: string = STORAGE_KEY): SchedulePlan[] {
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const result = PlansSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

export function savePlans(storage: Pick<Storage, "setItem">, plans: SchedulePlan[], key: string = STORAGE_KEY): void {
  try {
    storage.setItem(key, JSON.stringify(PlansSchema.parse(plans)));
  } catch {
    // Gracefully ignore quota exceeded or storage disabled in restricted browser contexts
  }
}

export function loadGuestPlans(storage: Pick<Storage, "getItem">): SchedulePlan[] {
  return loadPlans(storage, GUEST_STORAGE_KEY);
}

export function loadInitialGuestPlans(storage: Pick<Storage, "getItem">, termId: string): SchedulePlan[] {
  try {
    const source = storage.getItem(GUEST_STORAGE_KEY) !== null
      ? loadGuestPlans(storage)
      : storage.getItem(PLANS_OWNER_STORAGE_KEY)?.startsWith("user:") ? [] : loadPlans(storage);
    return source.filter((plan) => plan.termId === termId);
  } catch {
    return [];
  }
}

export function saveGuestPlans(storage: Pick<Storage, "setItem">, plans: SchedulePlan[]): void {
  savePlans(storage, plans, GUEST_STORAGE_KEY);
}

export function loadUserPlans(storage: Pick<Storage, "getItem">, userId: string): SchedulePlan[] {
  return loadPlans(storage, getUserPlansKey(userId));
}

export function saveUserPlans(storage: Pick<Storage, "setItem">, userId: string, plans: SchedulePlan[]): void {
  savePlans(storage, plans, getUserPlansKey(userId));
}

export function loadActivePlanId(storage: Pick<Storage, "getItem">, userId?: string | null): string | null {
  try {
    const key = userId ? getUserActivePlanKey(userId) : GUEST_ACTIVE_PLAN_KEY;
    const val = storage.getItem(key);
    if (val) return val;
    if (!userId) {
      return storage.getItem("lemon.active-plan.v1");
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActivePlanId(storage: Pick<Storage, "setItem">, planId: string, userId?: string | null): void {
  try {
    const key = userId ? getUserActivePlanKey(userId) : GUEST_ACTIVE_PLAN_KEY;
    storage.setItem(key, planId);
    if (!userId) {
      storage.setItem("lemon.active-plan.v1", planId);
    }
  } catch {
    // Gracefully handle storage restrictions
  }
}

export function clearGuestStorage(storage: Pick<Storage, "removeItem" | "getItem">): void {
  try {
    storage.removeItem(GUEST_STORAGE_KEY);
    storage.removeItem(GUEST_ACTIVE_PLAN_KEY);
    storage.removeItem(GUEST_AUTO_SCHEDULE_KEY);
    storage.removeItem(GUEST_GPA_DRAFT_KEY);
    storage.removeItem(GUEST_GPA_SCENARIOS_KEY);
    storage.removeItem("lemon.active-plan.v1");
    storage.removeItem("lemon.auto-schedule-preferences.v1");
    storage.removeItem("lemon.gpa-draft.v1");
    storage.removeItem("lemon.gpa-scenarios.v1");
    const owner = storage.getItem(PLANS_OWNER_STORAGE_KEY);
    if (!owner?.startsWith("user:")) {
      storage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Gracefully handle storage restrictions
  }
}

export interface GuestDataBackup {
  version: 1;
  exportedAt: string;
  plans: SchedulePlan[];
  activePlanId?: string | null;
  filters?: Partial<ExplorerFilters> | null;
  category?: "11" | "12" | null;
}

export interface LemonBackupV2 {
  version: 2;
  appName: "LEMON";
  schemaVersion: "2.0";
  exportedAt: string;
  plans: SchedulePlan[];
  activePlanId?: string | null;
  preferences?: {
    category?: "11" | "12" | null;
    viewMode?: ExplorerViewMode | null;
    theme?: string | null;
    language?: string | null;
    filters?: Partial<ExplorerFilters> | null;
  };
  gpaScenarios?: unknown[];
  gpaDraft?: unknown;
}

export type AnyLemonBackup = GuestDataBackup | LemonBackupV2;

export function exportGuestBackup(storage: Pick<Storage, "getItem">): GuestDataBackup {
  const plans = loadGuestPlans(storage);
  const activePlanId = loadActivePlanId(storage, null);
  const filters = loadSavedFilters(storage);
  const category = loadSavedCategory(storage);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    plans,
    activePlanId,
    filters,
    category,
  };
}

export function createLemonBackup(storage: Storage): LemonBackupV2 {
  const plans = loadGuestPlans(storage);
  const activePlanId = loadActivePlanId(storage, null);
  const filters = loadSavedFilters(storage);
  const category = loadSavedCategory(storage);
  const viewMode = loadSavedViewMode(storage);
  const theme = storage.getItem("lemon.theme.v1");
  const language = storage.getItem("lemon.language.v1");

  let gpaScenarios: unknown[] | undefined;
  try {
    const rawScenarios = storage.getItem(GUEST_GPA_SCENARIOS_KEY) || storage.getItem("lemon.gpa-scenarios.v1");
    if (rawScenarios) {
      const parsed = JSON.parse(rawScenarios);
      if (Array.isArray(parsed)) gpaScenarios = parsed;
    }
  } catch {
    // Storage restricted
  }

  let gpaDraft: unknown | undefined;
  try {
    const rawDraft = storage.getItem(GUEST_GPA_DRAFT_KEY) || storage.getItem("lemon.gpa-draft.v1");
    if (rawDraft) {
      gpaDraft = JSON.parse(rawDraft);
    }
  } catch {
    // Storage restricted
  }

  return {
    version: 2,
    appName: "LEMON",
    schemaVersion: "2.0",
    exportedAt: new Date().toISOString(),
    plans,
    activePlanId,
    preferences: {
      category,
      viewMode,
      theme,
      language,
      filters,
    },
    gpaScenarios,
    gpaDraft,
  };
}

export function getBackupFileName(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `lemon-backup-${yyyy}-${mm}-${dd}.json`;
}

export function validateBackupFileContent(raw: string): { isValid: boolean; error?: string; backup?: LemonBackupV2 } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { isValid: false, error: "Empty backup file content." };
  }
  if (raw.length > 5 * 1024 * 1024) {
    return { isValid: false, error: "File exceeds 5MB size limit." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { isValid: false, error: "Malformed JSON file." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { isValid: false, error: "Backup root must be an object." };
  }

  const record = parsed as Record<string, unknown>;

  if (record.version !== 1 && record.version !== 2) {
    return { isValid: false, error: "Unsupported backup version." };
  }

  if (!Array.isArray(record.plans)) {
    return { isValid: false, error: "Backup must contain a plans array." };
  }

  for (const plan of record.plans) {
    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      return { isValid: false, error: "Invalid plan record in backup." };
    }
    const p = plan as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id.trim()) {
      return { isValid: false, error: "Plan missing valid id." };
    }
    if (typeof p.name !== "string" || !p.name.trim()) {
      return { isValid: false, error: "Plan missing valid name." };
    }
    if (!Array.isArray(p.sectionIds)) {
      return { isValid: false, error: "Plan missing valid sectionIds array." };
    }
    for (const sId of p.sectionIds) {
      if (typeof sId !== "string") {
        return { isValid: false, error: "Invalid sectionId in plan." };
      }
    }
  }

  if (record.version === 1) {
    const v1Plans = record.plans as SchedulePlan[];
    return {
      isValid: true,
      backup: {
        version: 2,
        appName: "LEMON",
        schemaVersion: "2.0",
        exportedAt: typeof record.exportedAt === "string" ? record.exportedAt : new Date().toISOString(),
        plans: v1Plans,
        activePlanId: typeof record.activePlanId === "string" ? record.activePlanId : null,
        preferences: {
          category: record.category === "11" || record.category === "12" ? record.category : null,
          filters: record.filters && typeof record.filters === "object" ? (record.filters as Partial<ExplorerFilters>) : null,
        },
      },
    };
  }

  return {
    isValid: true,
    backup: parsed as LemonBackupV2,
  };
}

export function executeRestoreBackup(
  storage: Storage,
  backup: LemonBackupV2,
  mode: "merge" | "replace",
  currentPlans: SchedulePlan[],
): { restoredPlans: SchedulePlan[]; activePlanId: string } {
  let finalPlans: SchedulePlan[] = [];
  let nextActiveId = "";

  if (mode === "replace" || currentPlans.length === 0) {
    finalPlans = backup.plans;
    nextActiveId =
      backup.activePlanId && backup.plans.some((p) => p.id === backup.activePlanId)
        ? backup.activePlanId
        : backup.plans[0]?.id ?? "";
  } else {
    const existingIds = new Set(currentPlans.map((p) => p.id));
    const existingNames = new Set(currentPlans.map((p) => p.name));

    const importedProcessed = backup.plans.map((p) => {
      let finalId = p.id;
      let finalName = p.name;
      if (existingIds.has(finalId)) {
        finalId = `${p.id}-restored-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      }
      if (existingNames.has(finalName)) {
        finalName = `${p.name} (Restored)`;
      }
      existingIds.add(finalId);
      existingNames.add(finalName);
      return { ...p, id: finalId, name: finalName };
    });

    finalPlans = [...currentPlans, ...importedProcessed];
    nextActiveId = importedProcessed[0]?.id || currentPlans[0]?.id || "";
  }

  saveGuestPlans(storage, finalPlans);
  saveActivePlanId(storage, nextActiveId, null);

  if (backup.preferences?.category === "11" || backup.preferences?.category === "12") {
    saveSavedCategory(storage, backup.preferences.category);
  }
  if (backup.preferences?.viewMode === "cards" || backup.preferences?.viewMode === "table") {
    saveSavedViewMode(storage, backup.preferences.viewMode);
  }
  if (backup.preferences?.filters) {
    saveSavedFilters(storage, backup.preferences.filters as ExplorerFilters);
  }
  if (backup.gpaScenarios && Array.isArray(backup.gpaScenarios)) {
    try {
      storage.setItem(GUEST_GPA_SCENARIOS_KEY, JSON.stringify(backup.gpaScenarios));
    } catch {
      // Storage restricted
    }
  }
  if (backup.gpaDraft) {
    try {
      storage.setItem(GUEST_GPA_DRAFT_KEY, JSON.stringify(backup.gpaDraft));
    } catch {
      // Storage restricted
    }
  }

  return { restoredPlans: finalPlans, activePlanId: nextActiveId };
}

export function loadSavedFilters(storage: Pick<Storage, "getItem">): Partial<ExplorerFilters> | null {
  try {
    const raw = storage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<ExplorerFilters>;
  } catch {
    return null;
  }
}

export function saveSavedFilters(storage: Pick<Storage, "setItem">, filters: ExplorerFilters): void {
  try {
    storage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Gracefully handle storage restrictions
  }
}

export function loadSavedCategory(storage: Pick<Storage, "getItem">): "11" | "12" | null {
  try {
    const raw = storage.getItem(CATEGORY_STORAGE_KEY);
    if (raw === "11" || raw === "12") return raw;
    return null;
  } catch {
    return null;
  }
}

export function saveSavedCategory(storage: Pick<Storage, "setItem">, category: "11" | "12"): void {
  try {
    storage.setItem(CATEGORY_STORAGE_KEY, category);
  } catch {
    // Gracefully handle storage restrictions
  }
}

export function loadSavedViewMode(storage: Pick<Storage, "getItem">): ExplorerViewMode {
  try {
    const raw = storage.getItem(VIEW_MODE_STORAGE_KEY);
    if (raw === "cards" || raw === "table") return raw;
    return "cards";
  } catch {
    return "cards";
  }
}

export function saveSavedViewMode(storage: Pick<Storage, "setItem">, mode: ExplorerViewMode): void {
  try {
    storage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    // Gracefully handle storage restrictions
  }
}
