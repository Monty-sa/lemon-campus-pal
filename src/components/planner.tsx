"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getVerifiedUser, resetPasswordForEmail, signInWithEmail, signInWithGoogle, signOutUser, signUpWithEmail } from "@/lib/cloud/auth";
import { getBrowserSupabase } from "@/lib/cloud/client";
import { ensureProfile, updateProfile, type Profile } from "@/lib/cloud/profiles";
import { SupabaseScheduleStore } from "@/lib/cloud/schedules";
import { importGuestPlansToAccount, restoreGuestPlansOnLogout, syncPlansOnLogin } from "@/lib/cloud/sync";
import type { Course, DataImport, Day, SchedulePlan, Section } from "@/lib/schema";
import { layoutOverlappingItems } from "@/lib/meeting-layout";
import { addSectionToPlan, calculateCredits, findConflicts, formatTime, hasConflictWithSections } from "@/lib/schedule";
import { EARLIEST_TIME_OPTIONS, LATEST_TIME_OPTIONS } from "@/lib/auto-schedule";
import {
  CATEGORY_STORAGE_KEY,
  clearGuestStorage,
  exportGuestBackup,
  loadGuestPlans,
  loadActivePlanId,
  loadInitialGuestPlans,
  loadSavedCategory,
  loadSavedFilters,
  loadSavedViewMode,
  loadUserPlans,
  savePendingPlanSyncRecord,
  removePendingPlanSyncRecord,
  PLANS_OWNER_STORAGE_KEY,
  saveActivePlanId,
  saveGuestPlans,
  savePlans,
  saveSavedCategory,
  saveSavedFilters,
  saveSavedViewMode,
  saveUserPlans,
  STORAGE_KEY,
  type ExplorerViewMode,
} from "@/lib/storage";
import { computeFreshnessInfo, getRelativeTimeDescription } from "@/lib/kfu-monitor/status";
import type { KfuRefreshMetadata } from "@/lib/kfu-monitor/types";
import {
  loadInAppNotifications,
  saveInAppNotifications,
} from "@/lib/notifications/service";
import type { InAppNotification } from "@/lib/notifications/types";
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { maleOfferings } from "@/data/male-offerings";
import {
  getLanguageDirection,
  getLocalizedCourseTitle,
  getStoredLanguage,
  getTranslations,
  LANGUAGE_STORAGE_KEY,
  type Language,
  setStoredLanguage,
} from "@/lib/i18n";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  extractFilterOptions,
  filterSections,
  getDepartmentLabel,
  type ExplorerFilters,
} from "@/lib/explorer-filters";
import { OnboardingModal } from "./onboarding-modal";
import { RegistrationGuideModal } from "./registration-guide-modal";
import { CourseDetailsModal } from "./course-details-modal";
import { DataPrivacyModal } from "./data-privacy-modal";
import { VERIFIED_ACADEMIC_EVENTS_1448 } from "@/data/academic-calendar";
import { formatGregorianRange, getActiveOrUpcomingRegistrationEvent, getEventStatus } from "@/lib/academic-calendar";
import dynamic from "next/dynamic";

const AutoSchedulePanel = dynamic(() => import("./auto-schedule-panel").then((m) => m.AutoSchedulePanel));

const days: { id: Day }[] = [
  { id: "sun" },
  { id: "mon" },
  { id: "tue" },
  { id: "wed" },
  { id: "thu" },
];

const palette = ["lime", "mint", "sky", "sand", "violet", "coral"];

const verifiedTermLabels: Record<string, string> = {
  "144820": "Second Semester · Academic Year 1448",
};
const verifiedCollegeLabels: Record<string, string> = {
  "06": "College of Business Administration",
};
const verifiedCategoryLabels: Record<string, string> = {
  "11": "Male students",
  "12": "Female students",
};

function termLabel(data: DataImport, lang: Language = "en") {
  if (lang === "ar") {
    return data.term.labelAr ?? `الفصل ${data.term.id}`;
  }
  return data.term.labelEn ?? verifiedTermLabels[data.term.id] ?? `Semester ${data.term.id}`;
}

function collegeLabel(data: DataImport, lang: Language = "en") {
  if (lang === "ar") {
    return data.college.nameAr ?? `كلية ${data.college.id}`;
  }
  return data.college.nameEn ?? verifiedCollegeLabels[data.college.id] ?? `College ${data.college.id}`;
}

function categoryLabel(data: DataImport, lang: Language = "en") {
  if (!data.studentCategory) return "";
  if (lang === "ar") {
    return data.studentCategory.labelAr ?? `فئة ${data.studentCategory.id}`;
  }
  return data.studentCategory.labelEn ?? verifiedCategoryLabels[data.studentCategory.id] ?? `Category ${data.studentCategory.id}`;
}

function formatDate(value: string, lang: Language = "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string, lang: Language = "en") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function newPlan(termId: string, sequence = 1, lang: Language = getStoredLanguage()): SchedulePlan {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name: getTranslations(lang).planner.planDefaultName(sequence), termId, sectionIds: [], createdAt: now, updatedAt: now };
}

function sectionLabel(section: Section, course: Course, lang: Language = "en") {
  const loc = getLocalizedCourseTitle(course, lang);
  return `${course.code} · ${loc.title}`;
}

function Icon({ name }: { name: "search" | "calendar" | "copy" | "print" | "plus" | "trash" | "spark" | "sun" | "moon" | "monitor" | "user" | "x" | "gear" | "bell" | "table" | "cards" | "arrowUp" | "arrowDown" | "check" | "clock" | "download" | "document" | "image" | "pencil" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    print: <><path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    trash: <><path d="M4 7h16M9 3h6l1 4H8l1-4ZM7 7l1 14h8l1-14"/></>,
    spark: <><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"/>,
    monitor: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    x: <path d="M18 6 6 18M6 6l12 12"/>,
    gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    table: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 9v12M15 9v12"/></>,
    cards: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></>,
    arrowUp: <path d="m18 15-6-6-6 6"/>,
    arrowDown: <path d="m6 9 6 6 6-6"/>,
    check: <path d="M20 6 9 17l-5-5"/>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
    document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    pencil: <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>,
  };
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );
}

export function Planner({
  data: initialData,
  supabaseClient,
}: {
  data?: DataImport;
  supabaseClient?: SupabaseClient | null;
}) {
  const [selectedCategory, setSelectedCategory] = useState<"11" | "12">(() => {
    if (typeof window === "undefined") return (initialData?.studentCategory?.id as "11" | "12") ?? "11";
    const saved = loadSavedCategory(window.localStorage);
    return saved ?? (initialData?.studentCategory?.id as "11" | "12") ?? "11";
  });

  const [liveSnapshots, setLiveSnapshots] = useState<Record<"11" | "12", DataImport | null>>({
    "11": null,
    "12": null,
  });
  const [liveMetadata, setLiveMetadata] = useState<KfuRefreshMetadata | null>(null);

  const DEFAULT_FEMALE_SECTIONS_COUNT = 540;
  const data = liveSnapshots[selectedCategory] ?? initialData ?? maleOfferings;
  const maleSectionCount = liveSnapshots["11"]?.sections.length ?? maleOfferings.sections.length;
  const femaleSectionCount = liveSnapshots["12"]?.sections.length ?? DEFAULT_FEMALE_SECTIONS_COUNT;

  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [dataPrivacyModalOpen, setDataPrivacyModalOpen] = useState(false);
  const [expandedCourseMap, setExpandedCourseMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    async function loadSnapshot() {
      if (selectedCategory === "12" && !liveSnapshots["12"]) {
        import("@/data/female-offerings").then((m) => {
          if (isMounted) {
            setLiveSnapshots((prev) => (prev["12"] ? prev : { ...prev, "12": m.femaleOfferings }));
          }
        }).catch(() => {});
      }

      try {
        const res = await fetch(`/api/kfu/snapshot?category=${selectedCategory}`);
        if (!res.ok) return;
        const json = await res.json();
        if (isMounted && json?.snapshot?.courses && json?.snapshot?.sections) {
          setLiveSnapshots((prev) => ({
            ...prev,
            [selectedCategory]: json.snapshot,
          }));
          if (json.metadata) {
            setLiveMetadata(json.metadata);
          }
        }
      } catch {
        // Fallback gracefully to bundled snapshot on network error or offline mode
      }
    }

    loadSnapshot();
    return () => {
      isMounted = false;
    };
  }, [selectedCategory, liveSnapshots]);

  const [plans, setPlans] = useState<SchedulePlan[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = loadInitialGuestPlans(window.localStorage, data.term.id);
    return stored.length ? stored : [newPlan(data.term.id)];
  });
  const [activePlanId, setActivePlanId] = useState(() => {
    if (typeof window === "undefined") return plans[0]?.id ?? "";
    const storedActivePlanId = loadActivePlanId(window.localStorage, null);
    return storedActivePlanId && plans.some((plan) => plan.id === storedActivePlanId)
      ? storedActivePlanId
      : plans[0]?.id ?? "";
  });
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [toast, setToast] = useState(() => {
    if (typeof window === "undefined") return "";
    const err = new URLSearchParams(window.location.search).get("auth_error");
    return err ? `Authentication failed: ${decodeURIComponent(err)}` : "";
  });
  const [theme, setTheme] = useState<ThemePreference>(() => {
    if (typeof window === "undefined") return "system";
    try {
      const value = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemePreference(value)) return value;
    } catch {
      // Storage unavailable
    }
    return "system";
  });
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const t = useMemo(() => getTranslations(lang), [lang]);
  const upcomingRegEvent = useMemo(() => getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448), []);

  useEffect(() => {
    if (!hydrated) return;
    setStoredLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("dir", getLanguageDirection(lang));
  }, [hydrated, lang]);

  const [filters, setFilters] = useState<ExplorerFilters>(() => {
    if (typeof window === "undefined") {
      return {
        ...DEFAULT_FILTERS,
        termId: data.term.id,
        categoryCode: selectedCategory,
      };
    }
    const saved = loadSavedFilters(window.localStorage);
    return {
      ...DEFAULT_FILTERS,
      termId: data.term.id,
      categoryCode: selectedCategory,
      ...(saved ?? {}),
    };
  });
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const courseSearchRef = useRef<HTMLInputElement>(null);

  // LEMON-011C: Explorer Table / Card View Mode & Table Sorting
  const [viewMode, setViewMode] = useState<ExplorerViewMode>(() => {
    if (typeof window === "undefined") return "cards";
    return loadSavedViewMode(window.localStorage);
  });
  const [tableSortKey, setTableSortKey] = useState<"sectionCode" | "crn" | "course" | "instructor" | "time" | "availability">("course");
  const [tableSortDirection, setTableSortDirection] = useState<"asc" | "desc">("asc");

  // LEMON-016: In-App Notifications & Web Push State
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>(() => {
    if (typeof window === "undefined") return [];
    return loadInAppNotifications(window.localStorage);
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietHoursStart, setQuietHoursStart] = useState("22:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState("07:00");

  function handleViewModeChange(mode: ExplorerViewMode) {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      saveSavedViewMode(window.localStorage, mode);
    }
  }

  function handleTableSort(key: "sectionCode" | "crn" | "course" | "instructor" | "time" | "availability") {
    if (tableSortKey === key) {
      setTableSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortKey(key);
      setTableSortDirection("asc");
    }
  }

  const unreadNotificationsCount = useMemo(() => {
    return notifications.filter((n) => !n.readAt).length;
  }, [notifications]);

  function markAllNotificationsRead() {
    const updated = notifications.map((n) => ({ ...n, readAt: new Date().toISOString() }));
    setNotifications(updated);
    if (typeof window !== "undefined") {
      saveInAppNotifications(window.localStorage, updated);
    }
  }

  function clearNotifications() {
    setNotifications([]);
    if (typeof window !== "undefined") {
      saveInAppNotifications(window.localStorage, []);
    }
  }

  // LEMON-018: Download dropdown state
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // LEMON-024: First-visit welcome setup
  const [onboardingOpen, setOnboardingOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const completed = window.localStorage.getItem("lemon.onboarding-completed.v1");
      if (completed === "true") return false;
      const hasCategory = window.localStorage.getItem(CATEGORY_STORAGE_KEY) !== null;
      const hasLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) !== null;
      const hasPlans = window.localStorage.getItem(STORAGE_KEY) !== null;
      if (hasCategory || hasLanguage || hasPlans) {
        window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
        return false;
      }
      return true;
    } catch {
      return false;
    }
  });

  const [onboardingCategory, setOnboardingCategory] = useState<"11" | "12" | null>(() => {
    if (typeof window === "undefined") return null;
    return loadSavedCategory(window.localStorage);
  });

  function handleOnboardingLanguageChange(newLang: Language) {
    setLang(newLang);
    setStoredLanguage(newLang);
  }

  function handleOnboardingCategoryChange(newCat: "11" | "12") {
    setOnboardingCategory(newCat);
    handleCategoryChange(newCat);
  }

  function handleOnboardingComplete() {
    if (!onboardingCategory) return;
    try {
      saveSavedCategory(window.localStorage, onboardingCategory);
      setStoredLanguage(lang);
      window.localStorage.setItem("lemon.onboarding-completed.v1", "true");
    } catch {
      // Gracefully handle storage errors
    }
    setOnboardingOpen(false);
    window.setTimeout(() => {
      const search = courseSearchRef.current;
      if (search && typeof search.scrollIntoView === "function") search.scrollIntoView({ behavior: "smooth", block: "center" });
      search?.focus({ preventScroll: true });
    }, 0);
  }

  // LEMON-026: Registration Guidance Modal
  const [regGuideOpen, setRegGuideOpen] = useState(false);

  // LEMON-030: Calendar Course Details Modal
  const [selectedCalendarSection, setSelectedCalendarSection] = useState<Section | null>(null);

  // LEMON-030E: Inline Collapsible Auto Schedule Panel State (default collapsed)
  const [autoScheduleExpanded, setAutoScheduleExpanded] = useState(false);

  // LEMON-020: Table View Pagination & Navigation State
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState<number | "all">(50);

  function handleCategoryChange(newCategory: "11" | "12") {
    setSelectedCategory(newCategory);
    if (newCategory === "12" && !liveSnapshots["12"]) {
      import("@/data/female-offerings").then((m) => {
        setLiveSnapshots((prev) => (prev["12"] ? prev : { ...prev, "12": m.femaleOfferings }));
      }).catch(() => {});
    }
    if (typeof window !== "undefined") {
      saveSavedCategory(window.localStorage, newCategory);
    }
    setTablePage(1);
    setFilters((prev) => ({
      ...prev,
      categoryCode: newCategory,
      departmentId: "all",
      courseId: "all",
    }));
  }

  useEffect(() => {
    if (hydrated) {
      saveSavedFilters(window.localStorage, filters);
    }
  }, [hydrated, filters]);

  const supabase = useMemo(() => {
    if (supabaseClient !== undefined) return supabaseClient;
    return getBrowserSupabase();
  }, [supabaseClient]);

  const scheduleStore = useMemo(() => {
    if (!supabase) return null;
    return new SupabaseScheduleStore(supabase);
  }, [supabase]);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [syncStatus, setSyncStatus] = useState<"guest" | "synced" | "syncing" | "error">("guest");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");

  const [confirmClearGuestOpen, setConfirmClearGuestOpen] = useState(false);
  const [guestImportPromptOpen, setGuestImportPromptOpen] = useState(false);
  const [guestImportModalOpen, setGuestImportModalOpen] = useState(false);
  const [unimportedGuestPlansCount, setUnimportedGuestPlansCount] = useState(0);
  const [unimportedGuestPlans, setUnimportedGuestPlans] = useState<SchedulePlan[]>([]);
  const [clearScheduleDialogOpen, setClearScheduleDialogOpen] = useState(false);
  const [clearUndoPlan, setClearUndoPlan] = useState<{ planId: string; sectionIds: string[] } | null>(null);
  const clearConfirmationInProgressRef = useRef(false);
  const clearUndoInProgressRef = useRef(false);

  const plansRef = useRef(plans);
  const identityGenerationRef = useRef(0);
  const pendingPlanWritesRef = useRef(new Map<string, Promise<void>>());
  useEffect(() => {
    plansRef.current = plans;
  });

  useEffect(() => {
    if (hydrated && authReady && plans.length) {
      if (user) {
        saveUserPlans(window.localStorage, user.id, plans);
        savePlans(window.localStorage, plans);
        saveActivePlanId(window.localStorage, activePlanId, user.id);
        try {
          window.localStorage.setItem(PLANS_OWNER_STORAGE_KEY, `user:${user.id}`);
        } catch {
          // Planning remains usable when browser storage is disabled.
        }
      } else {
        saveGuestPlans(window.localStorage, plans);
        savePlans(window.localStorage, plans);
        saveActivePlanId(window.localStorage, activePlanId, null);
        try {
          window.localStorage.setItem(PLANS_OWNER_STORAGE_KEY, "guest");
        } catch {
          // Planning remains usable when browser storage is disabled.
        }
      }
    }
  }, [hydrated, authReady, plans, activePlanId, user]);

  useEffect(() => {
    if (!supabase || !scheduleStore) return;

    let mounted = true;
    const initialGeneration = ++identityGenerationRef.current;

    const switchToIdentityCache = (userId: string) => {
      const cachedPlans = loadUserPlans(window.localStorage, userId)
        .filter((plan) => plan.termId === data.term.id);
      const safePlans = cachedPlans.length ? cachedPlans : [newPlan(data.term.id)];
      const cachedActivePlanId = loadActivePlanId(window.localStorage, userId);
      setPlans(safePlans);
      setActivePlanId(
        cachedActivePlanId && safePlans.some((plan) => plan.id === cachedActivePlanId)
          ? cachedActivePlanId
          : safePlans[0].id,
      );
    };

    getVerifiedUser(supabase).then(async (currentUser) => {
      if (!mounted || initialGeneration !== identityGenerationRef.current) return;
      if (currentUser) {
        const plansAtAuthentication = plansRef.current;
        setUser(currentUser);
        setSyncStatus("syncing");
        switchToIdentityCache(currentUser.id);
        ensureProfile(supabase, currentUser)
          .then((p) => {
            if (mounted) setProfile(p);
          })
          .catch(() => {});
        try {
          const result = await syncPlansOnLogin(scheduleStore, window.localStorage, plansAtAuthentication, currentUser.id);
          if (mounted && initialGeneration === identityGenerationRef.current) {
            const userPlans = result.mergedPlans.length ? result.mergedPlans : [newPlan(data.term.id)];
            setPlans(userPlans);
            setActivePlanId((prev) => (userPlans.some((p) => p.id === prev) ? prev : userPlans[0].id));
            setSyncStatus("synced");
            if (result.hasUnimportedGuestPlans) {
              const guestPlans = loadGuestPlans(window.localStorage);
              setUnimportedGuestPlansCount(guestPlans.length);
              setUnimportedGuestPlans(guestPlans);
              const dismissed = typeof window !== "undefined" && window.sessionStorage?.getItem(`lemon.guest-import-dismissed.${currentUser.id}`);
              if (!dismissed) {
                setGuestImportPromptOpen(true);
              }
            }
          }
        } catch {
          if (mounted && initialGeneration === identityGenerationRef.current) setSyncStatus("error");
        }
        if (mounted && initialGeneration === identityGenerationRef.current) setAuthReady(true);
      } else {
        setUser(null);
        setProfile(null);
        setSyncStatus("guest");
        setAuthReady(true);
      }
    }).catch(() => {
      if (mounted) {
        setSyncStatus("guest");
        setAuthReady(true);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session?.user) {
        const generation = ++identityGenerationRef.current;
        const plansAtAuthentication = plansRef.current;
        setAuthReady(false);
        setUser(session.user);
        setSyncStatus("syncing");
        switchToIdentityCache(session.user.id);
        ensureProfile(supabase, session.user)
          .then((p) => {
            if (mounted) setProfile(p);
          })
          .catch(() => {});
        try {
          const result = await syncPlansOnLogin(scheduleStore, window.localStorage, plansAtAuthentication, session.user.id);
          if (mounted && generation === identityGenerationRef.current) {
            const userPlans = result.mergedPlans.length ? result.mergedPlans : [newPlan(data.term.id)];
            setPlans(userPlans);
            setActivePlanId((prev) => (userPlans.some((p) => p.id === prev) ? prev : userPlans[0].id));
            setSyncStatus("synced");
            setToast(t.auth.signedInToast);
            if (result.hasUnimportedGuestPlans) {
              const guestPlans = loadGuestPlans(window.localStorage);
              setUnimportedGuestPlansCount(guestPlans.length);
              setUnimportedGuestPlans(guestPlans);
              const dismissed = typeof window !== "undefined" && window.sessionStorage?.getItem(`lemon.guest-import-dismissed.${session.user.id}`);
              if (!dismissed) {
                setGuestImportPromptOpen(true);
              }
            }
          }
        } catch {
          if (mounted && generation === identityGenerationRef.current) setSyncStatus("error");
        }
        if (mounted && generation === identityGenerationRef.current) setAuthReady(true);
      } else if (event === "SIGNED_OUT") {
        ++identityGenerationRef.current;
        setUser(null);
        setProfile(null);
        setSettingsModalOpen(false);
        setGuestImportPromptOpen(false);
        setGuestImportModalOpen(false);
        setSyncStatus("guest");
        setAuthReady(true);
        const restored = restoreGuestPlansOnLogout(window.localStorage, newPlan(data.term.id));
        const cachedGuestActivePlanId = loadActivePlanId(window.localStorage, null);
        setPlans(restored);
        setActivePlanId(
          cachedGuestActivePlanId && restored.some((plan) => plan.id === cachedGuestActivePlanId)
            ? cachedGuestActivePlanId
            : restored[0]?.id ?? "",
        );
        setToast(t.auth.signedOutToast);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, scheduleStore, data.term.id, t]);

  useEffect(() => {
    if (!hydrated) return;
    const media = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const apply = () => {
      document.documentElement.dataset.theme = resolveTheme(theme, media?.matches ?? false);
    };
    apply();
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage unavailable
    }
    if (!media) return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth_error")) {
      params.delete("auth_error");
      const newQuery = params.toString();
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const activePlan = plans.find((plan) => plan.id === activePlanId) ?? plans[0];

  const selectedSections = useMemo(() => data.sections.filter((section) => activePlan?.sectionIds.includes(section.id)), [activePlan, data.sections]);
  const conflicts = useMemo(() => findConflicts(selectedSections), [selectedSections]);
  const calendarDayMinWidth = useMemo(() => Math.max(131, ...days.map((day) => {
    const dayMeetings = selectedSections.flatMap((section) => section.meetings
      .filter((meeting) => meeting.days.includes(day.id))
      .map((meeting) => ({ key: `${section.id}:${meeting.id}`, startMinutes: meeting.startMinutes, endMinutes: meeting.endMinutes })));
    return Math.max(1, ...layoutOverlappingItems(dayMeetings).map((meeting) => meeting.laneCount)) * 96;
  })), [selectedSections]);
  const courseMap = useMemo(() => new Map(data.courses.map((course) => [course.id, course])), [data.courses]);
  const colorMap = useMemo(() => new Map(selectedSections.map((section, index) => [section.id, palette[index % palette.length]])), [selectedSections]);
  const filterOptions = useMemo(() => extractFilterOptions(data), [data]);
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const availableCourses = useMemo(() => {
    if (filters.departmentId === "all") return data.courses;
    return data.courses.filter(
      (c) => (c.departmentId ?? c.code.split("-")[0]) === filters.departmentId,
    );
  }, [data.courses, filters.departmentId]);

  const { visibleSections, visibleGroups } = useMemo(() => {
    return filterSections(data.sections, data.courses, filters);
  }, [data.courses, data.sections, filters]);

  // Sort visible sections for table view
  const sortedTableSections = useMemo(() => {
    const list = [...visibleSections];
    return list.sort((a, b) => {
      let comparison = 0;
      const courseA = courseMap.get(a.courseId);
      const courseB = courseMap.get(b.courseId);

      if (tableSortKey === "sectionCode") {
        comparison = a.sectionCode.localeCompare(b.sectionCode, undefined, { numeric: true });
      } else if (tableSortKey === "crn") {
        comparison = a.crn.localeCompare(b.crn, undefined, { numeric: true });
      } else if (tableSortKey === "course") {
        const codeA = courseA?.code ?? "";
        const codeB = courseB?.code ?? "";
        comparison = codeA.localeCompare(codeB);
      } else if (tableSortKey === "instructor") {
        const nameA = a.instructor?.name ?? "";
        const nameB = b.instructor?.name ?? "";
        comparison = nameA.localeCompare(nameB, "ar");
      } else if (tableSortKey === "time") {
        const startA = a.meetings[0]?.startMinutes ?? 9999;
        const startB = b.meetings[0]?.startMinutes ?? 9999;
        comparison = startA - startB;
      } else if (tableSortKey === "availability") {
        comparison = a.status.localeCompare(b.status);
      }

      return tableSortDirection === "asc" ? comparison : -comparison;
    });
  }, [visibleSections, courseMap, tableSortKey, tableSortDirection]);

  const freshnessInfo = useMemo(() => {
    return computeFreshnessInfo(data.importedAt);
  }, [data.importedAt]);

  const staleSavedSections = useMemo(() => {
    if (!activePlan) return [];
    const list: { id: string; crn: string; section?: Section; reason: "cancelled" | "unavailable" }[] = [];
    for (const id of activePlan.sectionIds) {
      const section = data.sections.find((s) => s.id === id);
      if (!section) {
        list.push({ id, crn: id.split(":")[1] || id, reason: "unavailable" });
      } else if (section.status !== "open") {
        list.push({ id, crn: section.crn, section, reason: "unavailable" });
      }
    }
    return list;
  }, [activePlan, data.sections]);

  const totalTablePages = tablePageSize === "all" ? 1 : Math.max(1, Math.ceil(sortedTableSections.length / tablePageSize));
  const currentTablePage = Math.min(tablePage, totalTablePages);

  const paginatedTableSections = useMemo(() => {
    if (tablePageSize === "all") return sortedTableSections;
    const start = (currentTablePage - 1) * tablePageSize;
    return sortedTableSections.slice(start, start + tablePageSize);
  }, [sortedTableSections, currentTablePage, tablePageSize]);

  function scrollToSchedule() {
    if (typeof document !== "undefined") {
      const el = document.getElementById("schedule-section");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function updateFilter<K extends keyof ExplorerFilters>(key: K, value: ExplorerFilters[K]) {
    setTablePage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleClearAllFilters() {
    setTablePage(1);
    setFilters({
      ...DEFAULT_FILTERS,
      termId: data.term.id,
      categoryCode: data.studentCategory?.id ?? "11",
    });
  }

  function updateActive(transform: (plan: SchedulePlan) => SchedulePlan) {
    setClearUndoPlan(null);
    setPlans((current) => {
      const updated = current.map((plan) => (plan.id === activePlanId ? transform(plan) : plan));
      if (user && scheduleStore) {
        const targetPlan = updated.find((p) => p.id === activePlanId);
        if (targetPlan) {
          setSyncStatus("syncing");
          queueCloudPlanWrite(targetPlan)
            .then(() => setSyncStatus("synced"))
            .catch(() => setSyncStatus("error"));
        }
      }
      return updated;
    });
  }

  function queueCloudPlanWrite(plan: SchedulePlan): Promise<void> {
    if (!user || !scheduleStore) return Promise.resolve();
    const previousWrite = pendingPlanWritesRef.current.get(plan.id) ?? Promise.resolve();
    const currentWrite = previousWrite
      .catch(() => undefined)
      .then(() => scheduleStore.upsert([plan]));
    pendingPlanWritesRef.current.set(plan.id, currentWrite);
    void currentWrite.then(
      () => { if (pendingPlanWritesRef.current.get(plan.id) === currentWrite) pendingPlanWritesRef.current.delete(plan.id); },
      () => { if (pendingPlanWritesRef.current.get(plan.id) === currentWrite) pendingPlanWritesRef.current.delete(plan.id); },
    );
    return currentWrite;
  }

  function recordPendingCloudPlan(plan: SchedulePlan): string | null {
    if (!user) return null;
    const operationId = crypto.randomUUID();
    return savePendingPlanSyncRecord(window.localStorage, user.id, plan, operationId) ? operationId : "";
  }

  function clearScheduleFromActivePlan() {
    if (!activePlan || activePlan.sectionIds.length === 0 || clearConfirmationInProgressRef.current) return;
    clearConfirmationInProgressRef.current = true;
    const clearedPlan = { ...activePlan, sectionIds: [], updatedAt: new Date().toISOString() };
    const operationId = recordPendingCloudPlan(clearedPlan);
    if (user && scheduleStore && !operationId) {
      clearConfirmationInProgressRef.current = false;
      setToast(t.planner.clearSchedulePendingError);
      return;
    }

    setPlans((current) => current.map((plan) => plan.id === clearedPlan.id ? clearedPlan : plan));
    setClearUndoPlan({ planId: activePlan.id, sectionIds: [...activePlan.sectionIds] });
    setClearScheduleDialogOpen(false);
    setToast(t.planner.clearScheduleDone);

    if (user && scheduleStore && operationId) {
      setSyncStatus("syncing");
      void queueCloudPlanWrite(clearedPlan).then(() => {
        removePendingPlanSyncRecord(window.localStorage, user.id, clearedPlan.id, operationId);
        setSyncStatus("synced");
      }).catch(() => {
        setSyncStatus("error");
        setToast(t.planner.clearScheduleSyncError);
      });
    }
  }

  function undoClearSchedule() {
    if (!clearUndoPlan || clearUndoInProgressRef.current) return;
    const previous = clearUndoPlan;
    const currentPlan = plans.find((plan) => plan.id === previous.planId);
    if (!currentPlan) {
      setClearUndoPlan(null);
      return;
    }
    clearUndoInProgressRef.current = true;
    const restoredPlan = { ...currentPlan, sectionIds: [...previous.sectionIds], updatedAt: new Date().toISOString() };
    const operationId = recordPendingCloudPlan(restoredPlan);
    if (user && scheduleStore && !operationId) {
      clearUndoInProgressRef.current = false;
      setToast(t.planner.clearSchedulePendingError);
      return;
    }

    setPlans((current) => current.map((plan) => plan.id === restoredPlan.id ? restoredPlan : plan));
    setClearUndoPlan(null);
    setToast(t.planner.clearScheduleUndone);
    if (user && scheduleStore && operationId) {
      setSyncStatus("syncing");
      void queueCloudPlanWrite(restoredPlan).then(() => {
        removePendingPlanSyncRecord(window.localStorage, user.id, restoredPlan.id, operationId);
        setSyncStatus("synced");
      }).catch(() => {
        setSyncStatus("error");
        setToast(t.planner.clearScheduleSyncError);
      });
    }
  }

  const [editingPlanName, setEditingPlanName] = useState(() => activePlan?.name ?? "My Plan 1");
  const prevActivePlanIdRef = useRef(activePlan?.id);

  useEffect(() => {
    if (activePlan && prevActivePlanIdRef.current !== activePlan.id) {
      prevActivePlanIdRef.current = activePlan.id;
      setEditingPlanName(activePlan.name);
    }
  }, [activePlan]);

  function commitPlanRename() {
    if (!activePlan) return;
    const trimmed = editingPlanName.trim();
    if (!trimmed) {
      setEditingPlanName(activePlan.name);
      return;
    }
    const safeName = trimmed.slice(0, 120);
    if (safeName !== activePlan.name) {
      updateActive((plan) => ({ ...plan, name: safeName, updatedAt: new Date().toISOString() }));
      setToast(t.planner.planRenamedToast);
    }
    setEditingPlanName(safeName);
  }

  async function handleDownloadPdf() {
    setDownloadMenuOpen(false);
    try {
      const { exportSchedulePdf } = await import("@/lib/export/timetable-export");
      await exportSchedulePdf({
        planName: activePlan.name,
        termLabel: termLabel(data, lang),
        collegeLabel: collegeLabel(data, lang),
        categoryLabel: categoryLabel(data, lang),
        selectedSections,
        courseMap,
        isDarkTheme: typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
        lang,
      }, data.term.id);
      setToast(t.common.downloadPdfSuccess);
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : t.common.downloadError("PDF"));
    }
  }

  async function handleDownloadPng() {
    setDownloadMenuOpen(false);
    try {
      const { exportSchedulePng } = await import("@/lib/export/timetable-export");
      await exportSchedulePng({
        planName: activePlan.name,
        termLabel: termLabel(data, lang),
        collegeLabel: collegeLabel(data, lang),
        categoryLabel: categoryLabel(data, lang),
        selectedSections,
        courseMap,
        isDarkTheme: typeof document !== "undefined" && document.documentElement.dataset.theme === "dark",
        lang,
      }, data.term.id);
      setToast(t.common.downloadPngSuccess);
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : t.common.downloadError("PNG"));
    }
  }

  function toggleSection(section: Section) {
    if (!activePlan) return;
    if (activePlan.sectionIds.includes(section.id)) {
      updateActive((plan) => ({ ...plan, sectionIds: plan.sectionIds.filter((id) => id !== section.id), updatedAt: new Date().toISOString() }));
      setToast(t.planner.sectionRemovedToast);
      return;
    }
    try {
      updateActive((plan) => addSectionToPlan(plan, section, selectedSections));
      setToast(t.planner.sectionAddedToast);
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : "Cannot add section");
    }
  }

  function addPlan() {
    const plan = newPlan(data.term.id, plans.length + 1, lang);
    setPlans((current) => [...current, plan]);
    setActivePlanId(plan.id);
    setToast(t.planner.planCreatedToast);
    if (user && scheduleStore) {
      setSyncStatus("syncing");
      scheduleStore
        .upsert([plan])
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    }
  }

  function deleteActivePlan() {
    if (!activePlan || plans.length === 1) return;
    const planIdToDelete = activePlan.id;
    const remaining = plans.filter((plan) => plan.id !== planIdToDelete);
    setPlans(remaining);
    setActivePlanId(remaining[0].id);
    if (user && scheduleStore) {
      setSyncStatus("syncing");
      scheduleStore
        .remove([planIdToDelete])
        .then(() => setSyncStatus("synced"))
        .catch(() => setSyncStatus("error"));
    }
  }

  async function handleAuthSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    try {
      if (authMode === "signup") {
        const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
        const result = await signUpWithEmail(supabase, authEmail, authPassword, redirectUrl);
        if (result.needsEmailConfirmation) {
          setAuthNotice(result.message || t.auth.checkEmailNotice);
        } else {
          setAuthModalOpen(false);
          setToast(t.auth.accountCreatedToast);
        }
      } else if (authMode === "login") {
        await signInWithEmail(supabase, authEmail, authPassword);
        setAuthModalOpen(false);
        setToast(t.auth.signedInToast);
      } else if (authMode === "reset") {
        const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
        const result = await resetPasswordForEmail(supabase, authEmail, redirectUrl);
        setAuthNotice(result.message || t.auth.resetSentNotice);
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : t.auth.errorGeneric);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleExportGuestBackup() {
    if (typeof window === "undefined") return;
    const backup = exportGuestBackup(window.localStorage);
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lemon-guest-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleConfirmClearGuest() {
    if (typeof window === "undefined") return;
    clearGuestStorage(window.localStorage);
    const freshPlan = newPlan(data.term.id, 1, lang);
    setPlans([freshPlan]);
    setActivePlanId(freshPlan.id);
    setConfirmClearGuestOpen(false);
    setToast(t.planner.guestClearedToast);
  }

  function handleDismissGuestImport() {
    setGuestImportPromptOpen(false);
    setGuestImportModalOpen(false);
    if (user && typeof window !== "undefined") {
      try {
        window.sessionStorage?.setItem(`lemon.guest-import-dismissed.${user.id}`, "true");
      } catch {
        // Storage restricted
      }
    }
  }

  async function handleConfirmGuestImport() {
    if (!supabase || !scheduleStore || !user) return;
    try {
      const guestPlans = unimportedGuestPlans.length ? unimportedGuestPlans : loadGuestPlans(window.localStorage);
      const result = await importGuestPlansToAccount(
        scheduleStore,
        window.localStorage,
        user.id,
        plans,
        guestPlans,
      );
      setPlans(result.mergedPlans);
      if (result.mergedPlans.length > 0) {
        setActivePlanId(result.mergedPlans[0].id);
      }
      setGuestImportModalOpen(false);
      setGuestImportPromptOpen(false);
      setToast(t.planner.guestImportSuccessToast);
    } catch {
      setToast(t.auth.errorGeneric);
    }
  }

  async function handleGoogleSignIn() {
    if (!supabase) return;
    setAuthLoading(true);
    setAuthError("");
    setAuthNotice("");

    try {
      const redirectUrl = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
      await signInWithGoogle(supabase, redirectUrl);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : t.auth.googleSignInFailed);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) return;
    try {
      await signOutUser(supabase);
    } catch (err: unknown) {
      setToast(err instanceof Error ? err.message : "Sign out failed");
    }
  }

  function openSettingsModal() {
    if (profile) {
      setEditDisplayName(profile.displayName);
      setEditUsername(profile.username);
    } else if (user) {
      setEditDisplayName(user.email?.split("@")[0] || "Student");
      setEditUsername(
        (user.email?.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || "user",
      );
    }
    setProfileError("");
    setProfileSuccess("");
    setSettingsModalOpen(true);
  }

  async function handleProfileSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const updated = await updateProfile(supabase, {
        displayName: editDisplayName,
        username: editUsername,
      });
      setProfile(updated);
      setProfileSuccess(t.profile.savedSuccessAlert);
      setToast(t.profile.savedSuccessToast);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function copyCrns() {
    if (!selectedSections.length) return setToast(t.planner.chooseSectionFirstToast);
    const uniqueCrns = Array.from(new Set(selectedSections.map((section) => section.crn.trim()).filter(Boolean)));
    if (!uniqueCrns.length) return setToast(t.planner.chooseSectionFirstToast);
    try {
      await navigator.clipboard.writeText(uniqueCrns.join(" "));
      setToast(t.planner.crnsCopiedToast);
    } catch {
      setToast(t.planner.crnsCopiedToast);
    }
  }

  if (!hydrated || !activePlan) {
    return <main className="loading"><span className="lemon-mark">L</span><p>{getTranslations("en").common.loading}</p></main>;
  }

  const credits = calculateCredits(selectedSections, data.courses);

  return (
    <main className="student-planner" dir={getLanguageDirection(lang)} lang={lang}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={lang === "ar" ? "ليمون الرئيسية" : "LEMON home"}>
          <span className="brand-fruit"><span>LE</span><b>MON</b></span>
          <span className="brand-tag">{t.common.brandTag}</span>
        </a>
        <div className="source-pill">
          <span className="live-dot" /> {termLabel(data, lang)} · {t.common.importedAtLabel} {formatDate(data.importedAt, lang)}
        </div>
        <button
          type="button"
          className="service-status-pill"
          onClick={() => setStatusModalOpen(true)}
          title={lang === "ar" ? "عرض حالة النظام والخدمة" : "View system & service status"}
          aria-label={lang === "ar" ? "حالة النظام" : "System status"}
        >
          <span className="live-dot" />
          <span>{t.common.statusPill}</span>
        </button>
        <button
          type="button"
          className="notifications-pill"
          onClick={() => setNotificationsModalOpen(true)}
          title={lang === "ar" ? "تنبيهات الشعب وإعدادات الإشعارات" : "Section change alerts & push settings"}
          aria-label={`Notifications${unreadNotificationsCount > 0 ? ` (${unreadNotificationsCount} unread)` : ""}`}
        >
          <Icon name="bell" />
          <span>{t.common.alertsPill}</span>
          {unreadNotificationsCount > 0 && <span className="notification-badge">{unreadNotificationsCount}</span>}
        </button>
        <Link
          href="/gpa"
          className="admin-nav-link"
          title={t.common.gpaCalculatorNav}
        >
          {t.common.gpaCalculatorNav}
        </Link>
        <button
          type="button"
          className="welcome-setup-topbar-btn"
          onClick={() => setOnboardingOpen(true)}
          title={t.onboarding.reopenButton}
          aria-label={t.onboarding.reopenAria}
        >
          <span>🍋</span>
          <span className="welcome-setup-text">{t.onboarding.reopenButton}</span>
        </button>
        {supabase ? (
          user ? (
            <div className="account-pill" role="status" aria-label={lang === "ar" ? "حالة الحساب" : "Account status"}>
              <button
                type="button"
                className="profile-link-btn"
                onClick={openSettingsModal}
                title={t.common.accountSettings}
                aria-label={t.common.accountSettings}
              >
                <Icon name="user"/>
                <span className="profile-display-name">
                  <b>{profile ? profile.displayName : user.email}</b>
                  {profile && <span className="profile-handle">@{profile.username}</span>}
                </span>
              </button>
              <span className={`sync-pill ${syncStatus}`} title={lang === "ar" ? "حالة المزامنة السحابية" : "Cloud sync status"}>
                {syncStatus === "syncing" ? t.common.syncing : syncStatus === "error" ? t.common.syncFailed : t.common.synced}
              </span>
              <button
                type="button"
                className="ghost small icon-only"
                onClick={openSettingsModal}
                aria-label={lang === "ar" ? "الإعدادات" : "Settings"}
                title={lang === "ar" ? "الإعدادات" : "Settings"}
              >
                <Icon name="gear"/>
              </button>
              <button type="button" className="ghost small" onClick={handleLogout} aria-label={lang === "ar" ? "تسجيل الخروج" : "Sign out"}>
                {lang === "ar" ? "تسجيل الخروج" : "Log out"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ghost small auth-trigger"
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
                setAuthNotice("");
                setAuthModalOpen(true);
              }}
              aria-label={t.common.signIn}
            >
              <Icon name="user"/>
              <span>{t.common.signIn}</span>
            </button>
          )
        ) : (
          <button
            type="button"
            className="guest-badge guest-privacy-btn"
            onClick={() => setDataPrivacyModalOpen(true)}
            title={lang === "ar" ? "بياناتي والخصوصية · حفظ واستعادة النسخ الاحتياطية" : "Data & Privacy · Manage backups and local storage"}
            aria-label={t.dataPrivacy.dialogTitle}
          >
            <span>🛡️ {t.common.guestMode}</span>
          </button>
        )}
        <div className="theme-switcher" role="group" aria-label={t.common.theme}>
          <button
            type="button"
            className={theme === "light" ? "active" : ""}
            aria-pressed={theme === "light"}
            aria-label={lang === "ar" ? "المظهر الفاتح" : "Light theme"}
            title={lang === "ar" ? "المظهر الفاتح" : "Light theme"}
            onClick={() => setTheme("light")}
          >
            <Icon name="sun"/>
            <span className="theme-label">{t.common.lightTheme}</span>
          </button>
          <button
            type="button"
            className={theme === "dark" ? "active" : ""}
            aria-pressed={theme === "dark"}
            aria-label={lang === "ar" ? "المظهر الداكن" : "Dark theme"}
            title={lang === "ar" ? "المظهر الداكن" : "Dark theme"}
            onClick={() => setTheme("dark")}
          >
            <Icon name="moon"/>
            <span className="theme-label">{t.common.darkTheme}</span>
          </button>
          <button
            type="button"
            className={theme === "system" ? "active" : ""}
            aria-pressed={theme === "system"}
            aria-label={lang === "ar" ? "المظهر التلقائي" : "System theme"}
            title={lang === "ar" ? "المظهر التلقائي" : "System theme"}
            onClick={() => setTheme("system")}
          >
            <Icon name="monitor"/>
            <span className="theme-label">{t.common.systemTheme}</span>
          </button>
        </div>
        <div className="language-switcher flag-selector" role="group" aria-label={t.common.language}>
          <button
            type="button"
            className={`flag-btn ${lang === "ar" ? "active" : ""}`}
            onClick={() => setLang("ar")}
            aria-pressed={lang === "ar"}
            title={t.common.arabic}
            aria-label={t.common.arabic}
          >
            <span className="flag-icon" aria-hidden="true">🇸🇦</span>
            <span className="sr-only">{t.common.arabic}</span>
          </button>
          <button
            type="button"
            className={`flag-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            title={t.common.english}
            aria-label={t.common.english}
          >
            <span className="flag-icon" aria-hidden="true">🇬🇧</span>
            <span className="sr-only">{t.common.english}</span>
          </button>
        </div>
        <div className="download-dropdown-wrap">
          <button
            type="button"
            className="ghost small download-btn"
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            aria-expanded={downloadMenuOpen}
            aria-haspopup="menu"
            aria-label={lang === "ar" ? "تنزيل الجدول" : "Download schedule"}
            title={lang === "ar" ? "تنزيل الجدول" : "Download schedule"}
          >
            <Icon name="download" />
            <span>{t.common.downloadSchedule}</span>
            <span className="dropdown-caret">▾</span>
          </button>
          {downloadMenuOpen && (
            <div className="download-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={handleDownloadPdf}
              >
                <Icon name="document" />
                <span>{t.common.downloadPdf}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={handleDownloadPng}
              >
                <Icon name="image" />
                <span>{t.common.downloadPng}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><Icon name="spark"/> {t.planner.heroEyebrow}</div>
          <h1>{t.planner.heroTitleLine1}<br/><em>{t.planner.heroTitleLine2}</em></h1>
          <p>{t.planner.heroSubtitle}</p>
        </div>
        <div className="hero-stats" aria-label={lang === "ar" ? "ملخص الخطة" : "Plan summary"}>
          <div><b>{selectedSections.length}</b><span>{t.planner.statSectionsSelected}</span></div>
          <div><b>{credits}</b><span>{t.planner.statCreditHours}</span></div>
          <div className={conflicts.length ? "danger-stat" : "safe-stat"}>
            <b>{conflicts.length}</b>
            <span>{conflicts.length ? t.planner.statConflicts : t.planner.statNoConflicts}</span>
          </div>
        </div>
      </section>

      <section className="workspace vertical-layout">
        <section id="schedule-section" className="planner-panel full-width-schedule" aria-label={t.planner.weeklySchedule}>
          <div className="plan-toolbar">
            <div className="plan-title">
              <span className="step">{t.planner.step1}</span>
              <div className="plan-name-editor">
                <label htmlFor="plan-name-input" className="plan-name-label">
                  {t.planner.currentPlanLabel}
                  <span className="plan-name-hint">{t.planner.clickToRenameHint}</span>
                </label>
                <div className="plan-name-input-wrap">
                  <input
                    id="plan-name-input"
                    className="plan-name-input"
                    value={editingPlanName}
                    aria-label="Plan name"
                    maxLength={120}
                    placeholder={t.planner.planNamePlaceholder}
                    onChange={(e) => setEditingPlanName(e.target.value)}
                    onBlur={commitPlanRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      } else if (e.key === "Escape") {
                        setEditingPlanName(activePlan.name);
                        e.currentTarget.blur();
                      }
                    }}
                  />
                  <Icon name="pencil" />
                </div>
              </div>
            </div>
            <div className="plan-actions">
              <select value={activePlan.id} onChange={(event) => setActivePlanId(event.target.value)} aria-label={t.planner.choosePlanAria}>
                {plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name}</option>)}
              </select>
              <button className="icon-button" onClick={addPlan} aria-label={t.planner.addPlanAria}><Icon name="plus"/></button>
              <button className="icon-button danger" onClick={deleteActivePlan} disabled={plans.length === 1} aria-label={t.planner.deletePlanAria}><Icon name="trash"/></button>
              <button
                type="button"
                className="clear-schedule-button"
                disabled={!activePlan || activePlan.sectionIds.length === 0}
                aria-haspopup="dialog"
                onClick={() => {
                  clearConfirmationInProgressRef.current = false;
                  clearUndoInProgressRef.current = false;
                  setClearScheduleDialogOpen(true);
                }}
              >
                <Icon name="trash" />
                <span>{t.planner.clearSchedule}</span>
              </button>
            </div>
          </div>

          <div className="print-title">
            <div><b>{t.common.brandName}</b><span>{t.common.brandTag}</span></div>
            <strong>{activePlan.name}</strong>
            <small>{termLabel(data, lang)} · {collegeLabel(data, lang)}</small>
          </div>

          {conflicts.length > 0 && (
            <div className="conflict-banner" role="alert">
              <b>{t.planner.conflictBannerTitle}</b>
              <span>{t.planner.conflictBannerSub}</span>
            </div>
          )}

          {staleSavedSections.length > 0 && (
            <div className="plan-stale-warning" role="status">
              <span>⚠️ {t.planner.snapshotNoticeTitle}</span>
              <span>
                {staleSavedSections
                  .map((s) => s.reason === "cancelled" ? t.planner.snapshotNoticeCancelled(s.crn) : t.planner.snapshotNoticeUnavailable(s.crn))
                  .join(", ")}. {t.planner.snapshotNoticeSavedPlanIntact}
              </span>
            </div>
          )}

          <div className="calendar-shell">
              <div
                className="calendar-grid"
                style={{ "--calendar-day-min-width": `${calendarDayMinWidth}px` } as CSSProperties}
              >
              <div className="calendar-corner">{t.planner.timeCol}</div>
              {days.map((day) => (
                <div className="day-head" key={day.id}>
                  <b>{t.planner.days[day.id]}</b>
                  <span>{t.planner.daysShort[day.id]}</span>
                </div>
              ))}
              <div className="time-axis">
                {[7,8,9,10,11,12,13,14,15,16,17,18,19].map((hour) => (
                  <span key={hour} style={{ top: `${(hour - 7) * 72}px` }}>
                    <bdi dir="ltr">{String(hour).padStart(2, "0")}:00</bdi>
                  </span>
                ))}
              </div>
              {days.map((day) => (
                <div className="day-column" key={day.id}>
                  {layoutOverlappingItems(selectedSections.flatMap((section) => section.meetings
                    .filter((meeting) => meeting.days.includes(day.id))
                    .map((meeting) => ({ section, meeting, key: `${section.id}:${meeting.id}`, startMinutes: meeting.startMinutes, endMinutes: meeting.endMinutes }))))
                    .map(({ section, meeting, laneIndex, laneCount }) => {
                    const course = courseMap.get(section.courseId)!;
                    const isConflict = conflicts.some((conflict) => conflict.day === day.id && [conflict.firstSectionId, conflict.secondSectionId].includes(section.id));
                    const top = ((meeting.startMinutes - 420) / 60) * 72;
                    const height = Math.max(((meeting.endMinutes - meeting.startMinutes) / 60) * 72, 38);
                    const loc = getLocalizedCourseTitle(course, lang);
                    return (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        title={sectionLabel(section, course, lang)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCalendarSection(section);
                        }}
                        className={`class-block ${colorMap.get(section.id)} ${isConflict ? "has-conflict" : ""}`}
                        style={{
                          top,
                          height,
                          insetInlineStart: `calc(${laneIndex * 100 / laneCount}% + 4px)`,
                          insetInlineEnd: "auto",
                          width: `calc(${100 / laneCount}% - 8px)`,
                        }}
                        data-compact={height <= 44 ? "true" : undefined}
                        data-lane-count={laneCount}
                        key={`${meeting.id}-${day.id}`}
                      >
                        <b><bdi dir="ltr">{course.code}</bdi></b>
                        <span><bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>{loc.title}</bdi></span>
                        <small><bdi dir="ltr">{formatTime(meeting.startMinutes)} – {formatTime(meeting.endMinutes)}</bdi></small>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {selectedSections.length === 0 && (
              <div className="calendar-empty" role="status">
                <span className="lemon-outline">L</span>
                <b>{t.planner.emptyScheduleTitle}</b>
                <p>{t.planner.emptyScheduleSub}</p>
              </div>
            )}
          </div>

          <div className="summary-strip">
            <div className="summary-copy">
              <span>{t.planner.selectedCrnsTitle}</span>
              <div className="crn-list">
                {selectedSections.length
                  ? selectedSections.map((section) => (
                      <span className="crn-chip" key={section.id}>
                        <bdi dir="ltr">{section.crn}</bdi>
                      </span>
                    ))
                  : <span className="summary-empty">{t.planner.noSectionsSelected}</span>}
              </div>
            </div>
            <button className="copy-button" onClick={copyCrns} disabled={!selectedSections.length}>
              <Icon name="copy"/> {t.planner.copyCrns}
            </button>
          </div>
          {upcomingRegEvent && (
            <div className="academic-deadline-banner" role="region" aria-label={t.regGuide.academicDeadlineLabel}>
              <div className="deadline-content">
                <span className="deadline-badge-icon" aria-hidden="true">📅</span>
                <span className="deadline-status-tag">
                  {getEventStatus(upcomingRegEvent) === "active" ? t.regGuide.eventStatusActive : t.regGuide.eventStatusUpcoming}
                </span>
                <span className="deadline-title">
                  {lang === "ar" ? upcomingRegEvent.titleAr : upcomingRegEvent.titleEn}
                </span>
                <span className="deadline-dates">
                  ({formatGregorianRange(upcomingRegEvent.startDate, upcomingRegEvent.endDate, lang)})
                </span>
              </div>
              <a
                href={upcomingRegEvent.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="deadline-official-link"
              >
                {t.regGuide.officialCalendarLink}
              </a>
            </div>
          )}
        </section>

        <aside id="browse-courses-section" className="catalog full-width-catalog" aria-label={t.planner.browseSectionsTitle}>
          <div className="panel-heading">
            <div className="panel-heading-title-group">
              <span className="step">{t.planner.step2}</span>
              <h2>{t.planner.browseSectionsTitle}</h2>
              <button
                type="button"
                className="reg-guide-trigger-btn"
                onClick={() => setRegGuideOpen(true)}
                aria-label={t.regGuide.buttonAria}
                title={t.regGuide.buttonLabel}
              >
                <span>📚</span>
                <span>{t.regGuide.buttonLabel}</span>
              </button>
            </div>
            <div className="panel-heading-meta">
              <span className="result-count">
                {t.planner.courseSummary(visibleGroups.length, visibleSections.length)}
              </span>
              {selectedSections.length > 0 && (
                <button
                  type="button"
                  className="jump-to-schedule-btn"
                  onClick={scrollToSchedule}
                  title={t.common.backToSchedule}
                >
                  {t.common.backToScheduleWithCount(selectedSections.length)}
                </button>
              )}
            </div>
          </div>

          <div className="catalog-status-strip" role="status" aria-label={t.statusDialog.catalogTitle}>
            <div className="catalog-status-pills">
              <span className="catalog-status-heading">{t.statusDialog.catalogTitle}</span>
              <span className="catalog-status-divider">·</span>
              <span className={`status-pill-freshness ${freshnessInfo.isStale ? "outdated" : "updated"}`}>
                <span className="status-dot" aria-hidden="true" />
                <span>{freshnessInfo.isStale ? t.statusDialog.catalogFreshnessOutdated : t.statusDialog.catalogFreshnessUpdated}</span>
              </span>
              <span className="catalog-status-meta-item">
                {selectedCategory === "12" ? (lang === "ar" ? "طالبات" : "Female") : (lang === "ar" ? "طلاب" : "Male")}
              </span>
              <span className="catalog-status-divider">·</span>
              <span className="catalog-status-meta-item">
                {lang === "ar"
                  ? `${data.courses.length} مقرر · ${data.sections.length} شعبة`
                  : `${data.courses.length} courses · ${data.sections.length} sections`}
              </span>
              <span className="catalog-status-divider">·</span>
              <span className="catalog-status-meta-item" title={formatDate(liveMetadata?.lastPublishedSnapshot || data.importedAt, lang)}>
                {lang === "ar"
                  ? `آخر تحديث: ${getRelativeTimeDescription(liveMetadata?.lastPublishedSnapshot || data.importedAt, undefined, lang)}`
                  : `Updated ${getRelativeTimeDescription(liveMetadata?.lastPublishedSnapshot || data.importedAt)}`}
              </span>
            </div>
            <div className="catalog-status-portal-note" title={t.statusDialog.catalogPortalNote}>
              <span aria-hidden="true">ℹ️</span>
              <span>
                {lang === "ar"
                  ? "تأكيد المقاعد عبر بوابة الجامعة الرسمية"
                  : "Verify seat availability via official KFU portal"}
              </span>
            </div>
          </div>

          {guestImportPromptOpen && user && (
            <div
              className="guest-import-banner"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--accent-tint, rgba(200, 235, 60, 0.12))",
                border: "1px solid var(--accent, #9bbb12)",
                marginBottom: "14px",
              }}
            >
              <div>
                <strong>✨ {t.planner.guestImportPromptTitle}</strong>
                <p style={{ margin: "2px 0 0", fontSize: "13px" }}>
                  {t.planner.guestImportPromptDesc(unimportedGuestPlansCount)}
                </p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="admin-btn primary small"
                  onClick={() => setGuestImportModalOpen(true)}
                >
                  {t.planner.guestImportReviewButton}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary small"
                  onClick={handleDismissGuestImport}
                >
                  {t.planner.guestImportDismissButton}
                </button>
              </div>
            </div>
          )}

          {freshnessInfo.isStale && (
            <div
              className="stale-snapshot-banner"
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "8px",
                background: "var(--stale-banner-bg, rgba(234, 150, 0, 0.09))",
                border: "1px solid var(--stale-banner-border, rgba(234, 150, 0, 0.25))",
                marginBottom: "14px",
                fontSize: "13px",
              }}
            >
              <span>⚠️</span>
              <span>{t.planner.staleSnapshotBanner(getRelativeTimeDescription(data.importedAt, undefined, lang), formatDate(data.importedAt, lang))}</span>
            </div>
          )}

          <div className="catalog-primary-filters">
            <div className="primary-filter-item term-filter-item">
              <label className="field-label" htmlFor="term">{t.categorySelector.semesterLabel}</label>
              <select
                id="term"
                className="term-select readonly-term"
                value={data.term.id}
                disabled
                title={termLabel(data, lang)}
                aria-label={t.categorySelector.semesterLabel}
              >
                <option>{termLabel(data, lang)}</option>
              </select>
            </div>

            <div className="primary-filter-item category-selector-wrap">
              <label htmlFor="student-category" className="field-label">
                {t.categorySelector.label}
              </label>
              <div
                role="radiogroup"
                aria-label={lang === "ar" ? "تحديد فئة الطلاب" : "Select student category"}
                className="category-segmented"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategory === "11"}
                  className={`segmented-option ${selectedCategory === "11" ? "active" : ""}`}
                  onClick={() => handleCategoryChange("11")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      handleCategoryChange("12");
                    }
                  }}
                  tabIndex={selectedCategory === "11" ? 0 : -1}
                  aria-label={`👨 ${t.categorySelector.maleFull(maleSectionCount)}`}
                >
                  <span className="category-glyph">👨</span>
                  <span className="category-text">
                    <span className="category-title">{t.categorySelector.maleLabel}</span>
                    <span className="category-badge">{maleSectionCount}</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedCategory === "12"}
                  className={`segmented-option ${selectedCategory === "12" ? "active" : ""}`}
                  onClick={() => handleCategoryChange("12")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      handleCategoryChange("11");
                    }
                  }}
                  tabIndex={selectedCategory === "12" ? 0 : -1}
                  aria-label={`👩 ${t.categorySelector.femaleFull(femaleSectionCount)}`}
                >
                  <span className="category-glyph">👩</span>
                  <span className="category-text">
                    <span className="category-title">{t.categorySelector.femaleLabel}</span>
                    <span className="category-badge">{femaleSectionCount}</span>
                  </span>
                </button>
              </div>
              <select
                id="student-category"
                className="sr-only"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value as "11" | "12")}
                title={categoryLabel(data, lang)}
                aria-label={t.categorySelector.label}
                tabIndex={-1}
              >
                <option value="11">{t.categorySelector.maleFull(maleSectionCount)}</option>
                <option value="12">{t.categorySelector.femaleFull(femaleSectionCount)}</option>
              </select>
              {data.warnings.length > 0 && (
                <span className="dataset-warning-hint" role="status">
                  {t.categorySelector.warningOmitted(data.warnings.length)}
                </span>
              )}
            </div>

            <div className="primary-filter-item search-filter-item">
              <label className="field-label" htmlFor="course-search-input">{t.filters.searchCatalogLabel}</label>
              <label className="search-box">
                <Icon name="search"/>
                <input
                  id="course-search-input"
                  ref={courseSearchRef}
                  value={filters.query}
                  onChange={(event) => updateFilter("query", event.target.value)}
                  placeholder={t.filters.searchCatalogPlaceholder}
                  aria-label={t.filters.searchCatalogLabel}
                />
                {filters.query && (
                  <button onClick={() => updateFilter("query", "")} aria-label={t.filters.clearSearchAria}>
                    ×
                  </button>
                )}
              </label>
            </div>

            <div className="primary-filter-item status-filter-item">
              <span className="field-label">{t.filters.snapshotStatusLabel}</span>
              <div className="segmented" aria-label={t.filters.snapshotStatusLabel}>
                <button className={filters.status === "all" ? "active" : ""} onClick={() => updateFilter("status", "all")}>
                  {t.filters.allSections}
                </button>
                <button className={filters.status === "open" ? "active" : ""} onClick={() => updateFilter("status", "open")}>
                  {t.filters.availableInSnapshot}
                </button>
              </div>
            </div>
          </div>

          <div className="explorer-filters-panel">
            <div className="filters-header-row">
              <div className="filters-toggle-group">
                <button
                  type="button"
                  className="filters-toggle-btn"
                  onClick={() => setFiltersExpanded(!filtersExpanded)}
                  aria-expanded={filtersExpanded}
                >
                  <span>{filtersExpanded ? t.filters.advancedFiltersHide : t.filters.advancedFiltersShow}</span>
                  {activeFilterCount > 0 && <span className="filter-active-pill">{t.filters.activeFiltersCount(activeFilterCount)}</span>}
                </button>

                <button
                  type="button"
                  className={`auto-schedule-toggle-btn ${autoScheduleExpanded ? "active" : ""}`}
                  onClick={() => setAutoScheduleExpanded(!autoScheduleExpanded)}
                  aria-expanded={autoScheduleExpanded}
                  aria-controls="auto-schedule-collapse-panel"
                  title={autoScheduleExpanded ? (lang === "ar" ? "إخفاء لوحة التوليد الذكي" : "Hide Auto Schedule") : (lang === "ar" ? "✨ أنشئ جدولك تلقائيًا" : "✨ Auto Schedule")}
                >
                  <Icon name="spark" />
                  <span>{autoScheduleExpanded ? (lang === "ar" ? "إخفاء المولد الذكي" : "Hide Auto Schedule") : (lang === "ar" ? "✨ أنشئ جدولك تلقائيًا" : "✨ Auto Schedule")}</span>
                </button>
              </div>

              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="clear-all-link"
                  onClick={handleClearAllFilters}
                >
                  {t.common.clearAll}
                </button>
              )}
            </div>

            {filtersExpanded && (
              <>
                <div className="filters-grid">
                  <div className="filter-field">
                    <label htmlFor="filter-dept">{t.filters.deptLabel}</label>
                    <select
                      id="filter-dept"
                      className="filter-select"
                      value={filters.departmentId}
                      onChange={(e) => {
                        updateFilter("departmentId", e.target.value);
                        if (e.target.value !== "all") {
                          updateFilter("courseId", "all");
                        }
                      }}
                    >
                      <option value="all">{t.filters.allDepts}</option>
                      {filterOptions.departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{getDepartmentLabel(dept.id, lang)} ({dept.courseCount})</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filter-course">{t.filters.courseLabel}</label>
                    <select
                      id="filter-course"
                      className="filter-select"
                      value={filters.courseId}
                      onChange={(e) => updateFilter("courseId", e.target.value)}
                    >
                      <option value="all">{t.filters.allCourses}</option>
                      {availableCourses.map((c) => {
                        const loc = getLocalizedCourseTitle(c, lang);
                        return <option key={c.id} value={c.id}>{c.code} · {loc.title}</option>;
                      })}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filter-activity">{t.filters.activityLabel}</label>
                    <select
                      id="filter-activity"
                      className="filter-select"
                      value={filters.activity}
                      onChange={(e) => updateFilter("activity", e.target.value)}
                    >
                      <option value="all">{t.filters.allActivities}</option>
                      {filterOptions.activities.map((act) => (
                        <option key={act} value={act}>{act}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filter-instructor">{t.filters.instructorLabel}</label>
                    <select
                      id="filter-instructor"
                      className="filter-select"
                      value={filters.instructor}
                      onChange={(e) => updateFilter("instructor", e.target.value)}
                    >
                      <option value="all">{t.filters.allInstructors}</option>
                      {filterOptions.instructors.map((inst) => (
                        <option key={inst} value={inst}>{inst}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filter-crn">{t.filters.exactCrnLabel}</label>
                    <input
                      id="filter-crn"
                      type="text"
                      className="filter-text-input"
                      value={filters.exactCrn}
                      onChange={(e) => updateFilter("exactCrn", e.target.value)}
                      placeholder={t.filters.exactCrnPlaceholder}
                    />
                  </div>
                </div>

                <div className="days-filter-block">
                  <div className="days-header-line">
                    <span>{t.filters.meetingDaysLabel}</span>
                    <button
                      type="button"
                      className={`day-mode-btn ${filters.dayMode === "avoid" ? "avoid-mode" : ""}`}
                      onClick={() => updateFilter("dayMode", filters.dayMode === "match" ? "avoid" : "match")}
                      title={filters.dayMode === "match" ? t.filters.includesDays : t.filters.avoidsDays}
                    >
                      {filters.dayMode === "match" ? t.filters.includesDays : t.filters.avoidsDays}
                    </button>
                  </div>
                  <div className="days-chips-row">
                    {days.map((day) => {
                      const isSelected = filters.selectedDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          className={`day-toggle-chip ${isSelected ? "selected" : ""} ${isSelected && filters.dayMode === "avoid" ? "avoid-selected" : ""}`}
                          onClick={() => {
                            const next = isSelected
                              ? filters.selectedDays.filter((d) => d !== day.id)
                              : [...filters.selectedDays, day.id];
                            updateFilter("selectedDays", next);
                          }}
                          aria-pressed={isSelected}
                        >
                          {t.planner.daysShort[day.id]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="filters-grid">
                  <div className="filter-field">
                    <label htmlFor="filter-start-time">{t.filters.earliestStartLabel}</label>
                    <select
                      id="filter-start-time"
                      className="filter-select"
                      value={filters.startTimeMinutes ?? "any"}
                      onChange={(e) => updateFilter("startTimeMinutes", e.target.value === "any" ? null : Number(e.target.value))}
                    >
                      <option value="any">{t.filters.anyTime}</option>
                      {EARLIEST_TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatTime(minutes)}</option>)}
                    </select>
                  </div>

                  <div className="filter-field">
                    <label htmlFor="filter-end-time">{t.filters.latestEndLabel}</label>
                    <select
                      id="filter-end-time"
                      className="filter-select"
                      value={filters.endTimeMinutes ?? "any"}
                      onChange={(e) => updateFilter("endTimeMinutes", e.target.value === "any" ? null : Number(e.target.value))}
                    >
                      <option value="any">{t.filters.anyTime}</option>
                      {LATEST_TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{formatTime(minutes)}</option>)}
                      <option value="1140">07:00 PM</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* LEMON-030E: Inline Collapsible Auto Schedule Panel */}
          <div
            id="auto-schedule-collapse-panel"
            className="auto-schedule-collapsible-wrapper"
            hidden={!autoScheduleExpanded}
            style={{ display: autoScheduleExpanded ? "block" : "none" }}
          >
            <AutoSchedulePanel
              data={data}
              lang={lang}
              t={t}
              onSave={(plan) => {
                setPlans((current) => [...current, plan]);
                setActivePlanId(plan.id);
                if (user && scheduleStore) {
                  setSyncStatus("syncing");
                  scheduleStore.upsert([plan]).then(() => setSyncStatus("synced")).catch(() => setSyncStatus("error"));
                }
              }}
            />
          </div>

          <p className="snapshot-note">{t.filters.snapshotDisclaimer}</p>

          <div className="explorer-view-bar">
            <span className="results-badge">
              {t.filters.sectionsFoundCount(visibleSections.length)}
            </span>
            {selectedSections.length > 0 && (
              <button
                type="button"
                className="jump-to-schedule-btn subtle"
                onClick={scrollToSchedule}
                title={t.common.backToSchedule}
              >
                {t.planner.viewOnScheduleShortcut} ({selectedSections.length})
              </button>
            )}
            <div className="view-mode-toggle" role="group" aria-label={t.filters.viewModeAria}>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => handleViewModeChange("cards")}
                aria-pressed={viewMode === "cards"}
                title={t.filters.cardsView}
              >
                <Icon name="cards" />
                <span>{t.filters.cardsView}</span>
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => handleViewModeChange("table")}
                aria-pressed={viewMode === "table"}
                title={t.filters.tableView}
              >
                <Icon name="table" />
                <span>{t.filters.tableView}</span>
              </button>
            </div>
          </div>

          {visibleSections.length === 0 ? (
            <div className="empty">
              <Icon name="search"/>
              <b>{t.filters.noResultsTitle}</b>
              <span>{t.filters.noResultsSub}</span>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  className="ghost small"
                  onClick={handleClearAllFilters}
                  style={{ marginTop: 8 }}
                >
                  {t.filters.clearFiltersBtn}
                </button>
              )}
            </div>
          ) : viewMode === "table" ? (
            <div className="explorer-table-wrap" tabIndex={0} aria-label={t.table.tableAriaLabel}>
              <table className="explorer-table">
                <thead>
                  <tr>
                    <th scope="col" aria-sort={tableSortKey === "sectionCode" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("sectionCode")}>
                        <span>{t.table.section}</span>
                        {tableSortKey === "sectionCode" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col">{t.table.type}</th>
                    <th scope="col" aria-sort={tableSortKey === "crn" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("crn")}>
                        <span>{t.table.crn}</span>
                        {tableSortKey === "crn" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col" aria-sort={tableSortKey === "course" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("course")}>
                        <span>{t.table.course}</span>
                        {tableSortKey === "course" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col" aria-sort={tableSortKey === "instructor" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("instructor")}>
                        <span>{t.table.instructor}</span>
                        {tableSortKey === "instructor" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col">{t.table.days}</th>
                    <th scope="col" aria-sort={tableSortKey === "time" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("time")}>
                        <span>{t.table.time}</span>
                        {tableSortKey === "time" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col">{t.table.location}</th>
                    <th scope="col" aria-sort={tableSortKey === "availability" ? (tableSortDirection === "asc" ? "ascending" : "descending") : "none"}>
                      <button type="button" className="table-sort-btn" onClick={() => handleTableSort("availability")}>
                        <span>{t.table.availability}</span>
                        {tableSortKey === "availability" ? <Icon name={tableSortDirection === "asc" ? "arrowUp" : "arrowDown"} /> : null}
                      </button>
                    </th>
                    <th scope="col">{t.table.action}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTableSections.map((section) => {
                    const course = courseMap.get(section.courseId);
                    const isSelected = activePlan.sectionIds.includes(section.id);
                    const isConflict = !isSelected && hasConflictWithSections(section, selectedSections);
                    const location = section.meetings[0]?.location || t.table.notAvailable;
                    const activity = section.instructionalFormat || section.meetings[0]?.activity || t.table.notAvailable;

                    return (
                      <tr
                        key={section.id}
                        className={`table-row ${isSelected ? "selected" : ""} ${isConflict ? "conflict" : ""}`}
                      >
                        <td className="cell-section">
                          <strong>{section.sectionCode}</strong>
                          {isConflict && <span className="conflict-badge" title={t.table.conflictTooltip}>{t.table.conflictBadge}</span>}
                        </td>
                        <td className="cell-type">{activity}</td>
                        <td className="cell-crn">
                          <bdi dir="ltr"><code>{section.crn}</code></bdi>
                        </td>
                        <td className="cell-course">
                          <span className="course-code-tag"><bdi dir="ltr">{course?.code ?? section.courseId}</bdi></span>
                          {course && (() => {
                            const loc = getLocalizedCourseTitle(course, lang);
                            return (
                              <span className="course-title-sub">
                                <bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>{loc.title}</bdi>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="cell-instructor">
                          {section.instructor ? <bdi dir="rtl" lang="ar">{section.instructor.name}</bdi> : t.table.notAvailable}
                        </td>
                        <td className="cell-days">
                          {section.meetings.map((m, idx) => (
                            <div key={idx} className="table-meeting-block">
                              {m.days.map((d) => t.planner.daysShort[d] ?? d).join(", ")}
                            </div>
                          ))}
                          {section.meetings.length === 0 && (
                            <span className="tba-badge">{lang === "ar" ? "الوقت غير محدد (TBA)" : "Time TBA"}</span>
                          )}
                        </td>
                        <td className="cell-time">
                          {section.meetings.map((m, idx) => (
                            <div key={idx} className="table-meeting-block">
                              <bdi dir="ltr">{formatTime(m.startMinutes)}–{formatTime(m.endMinutes)}</bdi>
                            </div>
                          ))}
                          {section.meetings.length === 0 && (
                            <span className="tba-badge">{lang === "ar" ? "الوقت غير محدد (TBA)" : "Time TBA"}</span>
                          )}
                        </td>
                        <td className="cell-location">{location}</td>
                        <td className="cell-status">
                          <span
                            className={`status-pill ${section.status}`}
                            title={
                              lang === "ar"
                                ? "حالة الشعبة حسب آخر جدول منشور من الجامعة؛ ولا تعكس المقاعد اللحظية"
                                : "Section status as of latest university timetable snapshot; does not reflect live seat capacity"
                            }
                          >
                            {section.status === "open" ? t.table.availableStatus : section.status === "closed" ? t.table.unavailableStatus : t.table.unknownStatus}
                          </span>
                        </td>
                        <td className="cell-action">
                          <button
                            type="button"
                            className={isSelected ? "remove-button compact" : "add-button compact"}
                            onClick={() => toggleSection(section)}
                            aria-label={isSelected ? t.table.actionRemoveAria(section.sectionCode, section.crn) : t.table.actionAddAria(section.sectionCode, section.crn)}
                          >
                            {isSelected ? t.table.remove : <><Icon name="plus" /> {t.table.add}</>}
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              className="shortcut-to-schedule-btn"
                              onClick={scrollToSchedule}
                              title={t.common.backToSchedule}
                            >
                              {t.table.viewInScheduleShortcut}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sortedTableSections.length > 0 && (
                <div className="table-pagination-bar">
                  <div className="table-pagination-info">
                    {t.table.showingRows(
                      (currentTablePage - 1) * (tablePageSize === "all" ? sortedTableSections.length : tablePageSize) + 1,
                      tablePageSize === "all" ? sortedTableSections.length : Math.min(currentTablePage * tablePageSize, sortedTableSections.length),
                      sortedTableSections.length,
                    )}
                  </div>
                  {totalTablePages > 1 && (
                    <div className="table-pagination-controls" role="navigation" aria-label={lang === "ar" ? "تنقل صفحات الشعب" : "Sections pagination"}>
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={currentTablePage <= 1}
                        onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                        aria-label={t.table.previousPage}
                      >
                        {t.table.previousPage}
                      </button>
                      <div className="pagination-pages">
                        {Array.from({ length: totalTablePages }, (_, i) => i + 1)
                          .filter((page) => page === 1 || page === totalTablePages || Math.abs(page - currentTablePage) <= 1)
                          .map((page, idx, arr) => {
                            const prev = arr[idx - 1];
                            const hasGap = prev && page - prev > 1;
                            return (
                              <span key={page}>
                                {hasGap && <span className="pagination-ellipsis">…</span>}
                                <button
                                  type="button"
                                  className={`pagination-num-btn ${page === currentTablePage ? "active" : ""}`}
                                  onClick={() => setTablePage(page)}
                                  aria-current={page === currentTablePage ? "page" : undefined}
                                >
                                  {page}
                                </button>
                              </span>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={currentTablePage >= totalTablePages}
                        onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                        aria-label={t.table.nextPage}
                      >
                        {t.table.nextPage}
                      </button>
                    </div>
                  )}
                  <div className="table-page-size-selector">
                    <span>{t.table.rowsPerPage}</span>
                    <select
                      value={tablePageSize}
                      onChange={(e) => {
                        const val = e.target.value === "all" ? "all" : Number(e.target.value);
                        setTablePageSize(val);
                        setTablePage(1);
                      }}
                      aria-label={lang === "ar" ? "الشعب في كل صفحة" : "Sections per page"}
                      className="page-size-select"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value="all">{t.table.allRows}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="section-list">
              {visibleGroups.map(({ course, sections }) => {
                const selectedCount = sections.filter((section) => activePlan.sectionIds.includes(section.id)).length;
                const isExpanded = Boolean(expandedCourseMap[course.id]);
                const visibleSectionsForCourse = isExpanded || sections.length <= 4
                  ? sections
                  : sections.filter((s, idx) => idx < 4 || activePlan.sectionIds.includes(s.id));
                const hiddenCount = sections.length - visibleSectionsForCourse.length;

                return (
                  <section className="course-group" key={course.id} aria-labelledby={`course-${course.id}`}>
                    <header className="course-heading">
                      <div>
                        <span className="course-code"><bdi dir="ltr">{course.code}</bdi></span>
                        {(() => {
                          const loc = getLocalizedCourseTitle(course, lang);
                          return (
                            <h3 id={`course-${course.id}`}>
                              <bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>{loc.title}</bdi>
                            </h3>
                          );
                        })()}
                      </div>
                      <div className="course-heading-meta">
                        <span>{course.credits} {t.planner.creditsUnit}</span>
                        <span>{sections.length} {sections.length === 1 ? t.planner.sectionUnit : t.planner.sectionsUnit}</span>
                        {selectedCount > 0 && <span className="selected-count">{t.planner.selectedInPlanCount(selectedCount)}</span>}
                      </div>
                    </header>
                    <div className="course-sections">
                      {visibleSectionsForCourse.map((section) => {
                        const selected = activePlan.sectionIds.includes(section.id);
                        return (
                          <article className={`section-card ${selected ? "selected" : ""}`} key={section.id}>
                            <details className="section-disclosure">
                              <summary className="section-summary">
                                <span className="chevron" aria-hidden="true">›</span>
                                <span className="section-summary-main">
                                  <span className="section-label">{t.planner.sectionCardCode(section.sectionCode)}</span>
                                  <span className="section-crn"><bdi dir="ltr">CRN {section.crn}</bdi></span>
                                </span>
                                <span className="section-summary-meta">
                                  <span className={`section-time ${section.meetings.length === 0 ? "tba-badge" : ""}`}>
                                    {section.meetings.length > 0 ? (
                                      <>
                                        {section.meetings.map((meeting) => <span key={meeting.id} className="section-summary-meeting">{meeting.days.map((d) => t.planner.daysShort[d] ?? d).join(", ")} · <bdi dir="ltr">{formatTime(meeting.startMinutes)}–{formatTime(meeting.endMinutes)}</bdi></span>)}
                                      </>
                                    ) : (
                                      lang === "ar" ? "الوقت غير محدد (TBA)" : "Time TBA"
                                    )}
                                  </span>
                                  <span
                                    className={`status ${section.status}`}
                                    title={
                                      lang === "ar"
                                        ? "حالة الشعبة حسب آخر جدول منشور من الجامعة؛ ولا تعكس المقاعد اللحظية"
                                        : "Section status as of latest university timetable snapshot; does not reflect live seat capacity"
                                    }
                                  >
                                    {section.status === "open" ? t.table.availableStatus : section.status === "closed" ? t.table.unavailableStatus : t.table.unknownStatus}
                                  </span>
                                </span>
                              </summary>
                              <div className="section-details">
                                <dl className="section-facts">
                                  <div><dt>{t.planner.factsCrn}</dt><dd><bdi dir="ltr">{section.crn}</bdi></dd></div>
                                  <div><dt>{t.planner.factsSection}</dt><dd>{section.sectionCode}</dd></div>
                                  <div><dt>{t.planner.factsCredits}</dt><dd>{course.credits}</dd></div>
                                  <div><dt>{t.planner.factsAvailability}</dt><dd>{section.status === "open" ? t.table.availableStatus : section.status === "closed" ? t.table.unavailableStatus : t.table.unknownStatus}</dd></div>
                                </dl>
                                <div className="meeting-lines">
                                  {section.meetings.map((meeting) => (
                                    <span key={meeting.id}>
                                      <Icon name="calendar"/> {meeting.days.map((day) => t.planner.days[day] ?? day).join(", ")} · <bdi dir="ltr">{formatTime(meeting.startMinutes)}–{formatTime(meeting.endMinutes)}</bdi>
                                    </span>
                                  ))}
                                  {section.meetings.length === 0 && (
                                    <span className="missing-value tba-badge">
                                      <Icon name="calendar"/> {lang === "ar" ? "الوقت غير محدد (TBA)" : "Time TBA"}
                                    </span>
                                  )}
                                </div>
                                <div className="instructor">
                                  {section.instructor ? (
                                    <>
                                      <bdi dir="rtl" lang="ar">{section.instructor.name}</bdi>
                                      <a
                                        href="https://t.me/+br6ivC0jUog2MTQ0"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="instructor-community-link"
                                        title={t.community.subtleLinkTitle}
                                      >
                                        💬 {t.community.subtleLink}
                                      </a>
                                    </>
                                  ) : (
                                    t.planner.instructorNotListed
                                  )}
                                </div>
                                {section.status !== "open" && (
                                  <p className="availability-warning">
                                    {section.status === "closed" ? t.planner.warningClosedSection : t.planner.warningUnknownSection}
                                  </p>
                                )}
                              </div>
                            </details>
                            <div className="card-action-bar">
                              <button
                                className={selected ? "remove-button" : "add-button"}
                                onClick={() => toggleSection(section)}
                                aria-label={selected ? t.planner.removeSectionAria(course.code, section.sectionCode) : t.planner.addSectionAria(course.code, section.sectionCode)}
                              >
                                {selected ? t.planner.removeSectionFromPlan : <><Icon name="plus"/> {t.planner.addSectionToPlan}</>}
                              </button>
                              {selected && (
                                <button
                                  type="button"
                                  className="card-schedule-shortcut"
                                  onClick={scrollToSchedule}
                                  title={t.common.backToSchedule}
                                >
                                  {t.planner.viewOnScheduleShortcut}
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {sections.length > 4 && (
                      <button
                        type="button"
                        className="course-sections-expand-btn"
                        onClick={() => setExpandedCourseMap((prev) => ({ ...prev, [course.id]: !isExpanded }))}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded
                          ? (lang === "ar" ? "▲ عرض شعب أقل" : "▲ Show fewer sections")
                          : (lang === "ar"
                              ? `▼ عرض جميع الـ ${sections.length} شعبة (+${hiddenCount})`
                              : `▼ Show all ${sections.length} sections (+${hiddenCount} more)`)}
                      </button>
                    )}
                  </section>
                );
              })}
            </div>
          )}

          {/* LEMON-044: Student Professor Experiences Community Section */}
          <section className="student-community-card" aria-label={t.community.heading}>
            <div className="community-card-content">
              <div className="community-card-icon" aria-hidden="true">💬</div>
              <div className="community-card-text">
                <h3 className="community-card-title">{t.community.heading}</h3>
                <p className="community-card-desc">{t.community.description}</p>
                <span className="community-card-disclaimer">{t.community.disclaimer}</span>
              </div>
            </div>
            <a
              href="https://t.me/+br6ivC0jUog2MTQ0"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-btn primary community-card-btn"
              aria-label={t.community.buttonAria}
            >
              <span>{t.community.button}</span>
              <span className="community-btn-arrow" aria-hidden="true">{lang === "ar" ? "←" : "→"}</span>
            </a>
          </section>
        </aside>

        {selectedSections.length > 0 && (
          <aside className="floating-schedule-anchor" aria-label={lang === "ar" ? "اختصار العودة للجدول" : "Schedule shortcut"}>
            <button
              type="button"
              className="floating-schedule-pill"
              onClick={scrollToSchedule}
              title={t.common.backToSchedule}
            >
              <Icon name="calendar" />
              <span>{t.common.backToScheduleWithCount(selectedSections.length)}</span>
            </button>
          </aside>
        )}
      </section>

      <section className="data-note">
        <div>
          <b>{t.common.sourceDataHeading}</b>
          <p>{t.common.sourceDataNote(termLabel(data, lang), collegeLabel(data, lang), categoryLabel(data, lang), formatDateTime(data.importedAt, lang))}</p>
        </div>
        <a href={data.sourceUrl} target="_blank" rel="noreferrer">
          {t.common.viewOfficialSource}
        </a>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-tagline">
            <b>{t.common.footerTagline}</b>
          </div>
          <p className="footer-disclaimer">{t.common.footerDisclaimer}</p>
          <div className="footer-links">
            <a
              className="footer-link-btn"
              href="https://github.com/Monty-sa/lemon-campus-pal"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.common.githubLink}
            >
              <svg className="footer-link-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.77c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
              </svg>
              {t.common.githubLink}
            </a>
            <a
              className="footer-link-btn"
              href="https://t.me/Muntadar26"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.common.contactDeveloperLink}
            >
              <svg className="footer-link-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21.4 3.6-3.1 16.1c-.23 1.14-.84 1.42-1.7.88l-4.74-3.5-2.29 2.2c-.25.25-.46.46-.95.46l.34-4.82 8.78-7.94c.38-.34-.08-.53-.59-.19L6.3 13.63l-4.67-1.46c-1.02-.32-1.04-1.02.21-1.51L20.1 3.62c.85-.31 1.59.19 1.3-.02Z" />
              </svg>
              {t.common.contactDeveloperLink}
            </a>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => setOnboardingOpen(true)}
              aria-label={t.onboarding.reopenAria}
            >
              {t.onboarding.reopenButton}
            </button>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => setDataPrivacyModalOpen(true)}
            >
              🛡️ {t.dataPrivacy.dialogTitle}
            </button>
          </div>
        </div>
      </footer>

      {authModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAuthModalOpen(false)}>
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="auth-modal-title">
                  {authMode === "login" ? t.auth.modalTitleLogin : authMode === "signup" ? t.auth.modalTitleSignup : t.auth.modalTitleReset}
                </h2>
                <p>
                  {authMode === "login"
                    ? t.auth.modalSubtitleLogin
                    : authMode === "signup"
                    ? t.auth.modalSubtitleSignup
                    : t.auth.modalSubtitleReset}
                </p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setAuthModalOpen(false)}
                aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
              >
                <Icon name="x"/>
              </button>
            </header>

            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authError && <div className="auth-alert error" role="alert">{authError}</div>}
              {authNotice && <div className="auth-alert success" role="status">{authNotice}</div>}

              {authMode !== "reset" && (
                <>
                  <button
                    type="button"
                    className="oauth-button google"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                  >
                    <GoogleIcon />
                    <span>{t.auth.continueWithGoogle}</span>
                  </button>
                  <p className="auth-google-note" style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 14px", textAlign: "center" }}>
                    🌟 {t.auth.googlePrimaryNotice}
                  </p>
                  <div className="auth-divider" aria-hidden="true">
                    <span>{t.auth.orContinueWithEmail}</span>
                  </div>
                </>
              )}

              {authMode === "signup" && (
                <div
                  className="auth-alert notice"
                  role="status"
                  style={{
                    fontSize: "13px",
                    marginBottom: "14px",
                    background: "var(--accent-tint, rgba(200, 235, 60, 0.12))",
                    border: "1px solid var(--accent, #9bbb12)",
                    borderRadius: "6px",
                    padding: "10px 12px",
                  }}
                >
                  ℹ️ {t.auth.signupDisabledNotice}
                </div>
              )}

              <label className="field-label" htmlFor="auth-email">{t.auth.emailLabel}</label>
              <input
                id="auth-email"
                type="email"
                required
                autoComplete="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder={t.auth.emailPlaceholder}
                className="auth-input"
              />

              {authMode !== "reset" && (
                <>
                  <div className="field-header">
                    <label className="field-label" htmlFor="auth-password">{t.auth.passwordLabel}</label>
                    {authMode === "login" && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setAuthMode("reset");
                          setAuthError("");
                          setAuthNotice("");
                        }}
                      >
                        {t.auth.forgotPassword}
                      </button>
                    )}
                  </div>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete={authMode === "signup" ? "new-password" : "current-password"}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={t.auth.passwordPlaceholder}
                    className="auth-input"
                  />
                </>
              )}

              <button type="submit" className="auth-submit" disabled={authLoading}>
                {authLoading ? t.auth.pleaseWait : authMode === "login" ? t.auth.signInButton : authMode === "signup" ? t.auth.createAccountButton : t.auth.sendResetLinkButton}
              </button>
            </form>

            <footer className="auth-modal-footer">
              {authMode === "login" ? (
                <p>
                  {t.auth.switchPromptSignup}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAuthMode("signup");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                  >
                    {t.auth.switchActionSignup}
                  </button>
                </p>
              ) : (
                <p>
                  {t.auth.switchPromptLogin}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setAuthMode("login");
                      setAuthError("");
                      setAuthNotice("");
                    }}
                  >
                    {t.auth.switchActionLogin}
                  </button>
                </p>
              )}
            </footer>
          </div>
        </div>
      )}

      {settingsModalOpen && user && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSettingsModalOpen(false)}>
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="settings-modal-title">{t.profile.modalTitle}</h2>
                <p>{t.profile.modalSubtitle}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setSettingsModalOpen(false)}
                aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
              >
                <Icon name="x"/>
              </button>
            </header>

            <form onSubmit={handleProfileSubmit} className="auth-form">
              {profileError && <div className="auth-alert error" role="alert">{profileError}</div>}
              {profileSuccess && <div className="auth-alert success" role="status">{profileSuccess}</div>}

              <div>
                <span className="field-label">{t.profile.emailLabel}</span>
                <div className="verified-email-field">
                  <span><bdi dir="ltr">{user.email}</bdi></span>
                  <span className="verified-badge">{t.profile.privateBadge}</span>
                </div>
                <small className="field-hint">{t.profile.emailPrivateHint}</small>
              </div>

              <div>
                <label className="field-label" htmlFor="profile-display-name">{t.profile.displayNameLabel}</label>
                <input
                  id="profile-display-name"
                  type="text"
                  required
                  maxLength={60}
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder={t.profile.displayNamePlaceholder}
                  className="auth-input"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="profile-username">{t.profile.usernameLabel}</label>
                <div className="username-input-wrap">
                  <span className="username-at">@</span>
                  <input
                    id="profile-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder={t.profile.usernamePlaceholder}
                    className="auth-input username-input"
                  />
                </div>
                <small className="field-hint">{t.profile.usernameHint}</small>
              </div>

              <button type="submit" className="auth-submit" disabled={profileSaving}>
                {profileSaving ? t.profile.saving : t.profile.saveChanges}
              </button>

              <div className="settings-extra-actions">
                <button
                  type="button"
                  className="admin-btn secondary full-width"
                  onClick={() => {
                    setSettingsModalOpen(false);
                    setOnboardingOpen(true);
                  }}
                  aria-label={t.onboarding.reopenAria}
                >
                  {t.onboarding.reopenButton}
                </button>
                {user && loadGuestPlans(window.localStorage).length > 0 && (
                  <button
                    type="button"
                    className="admin-btn secondary full-width"
                    style={{ marginTop: "8px" }}
                    onClick={() => {
                      setSettingsModalOpen(false);
                      setUnimportedGuestPlans(loadGuestPlans(window.localStorage));
                      setGuestImportModalOpen(true);
                    }}
                  >
                    📥 {t.planner.guestImportModalTitle} ({loadGuestPlans(window.localStorage).length})
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {statusModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setStatusModalOpen(false)}>
          <div
            className="auth-modal status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="status-modal-title">{t.statusDialog.modalTitle}</h2>
                <p>{t.statusDialog.modalSubtitle}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setStatusModalOpen(false)}
                aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
              >
                <Icon name="x"/>
              </button>
            </header>

            <div className="status-modal-body">
              <div className="status-item">
                <div className="status-item-header">
                  <strong>{t.statusDialog.planningEngineTitle}</strong>
                  <span className="status-badge-ok">{t.statusDialog.planningEngineStatus}</span>
                </div>
                <p>{t.statusDialog.planningEngineDesc}</p>
              </div>

              <div className="status-item">
                <div className="status-item-header">
                  <strong>{t.statusDialog.cloudSyncTitle}</strong>
                  <span className={supabase ? (syncStatus === "error" ? "status-badge-degraded" : "status-badge-ok") : "status-badge-guest"}>
                    {!supabase ? t.statusDialog.cloudSyncGuest : syncStatus === "error" ? t.statusDialog.cloudSyncDegraded : t.statusDialog.cloudSyncOperational}
                  </span>
                </div>
                <p>
                  {!supabase
                    ? t.statusDialog.cloudSyncGuestDesc
                    : syncStatus === "error"
                    ? t.statusDialog.cloudSyncDegradedDesc
                    : t.statusDialog.cloudSyncOperationalDesc}
                </p>
                {!supabase && (
                  <button
                    type="button"
                    className="ghost small"
                    style={{ marginTop: "6px" }}
                    onClick={() => {
                      setStatusModalOpen(false);
                      setDataPrivacyModalOpen(true);
                    }}
                  >
                    🛡️ {t.dataPrivacy.dialogTitle}
                  </button>
                )}
              </div>

              <div className="status-item">
                <div className="status-item-header">
                  <strong>{t.statusDialog.catalogTitle}</strong>
                  <span className={`status-badge-${freshnessInfo.isStale ? "degraded" : "snapshot"}`}>
                    {freshnessInfo.isStale ? t.statusDialog.catalogFreshnessOutdated : t.statusDialog.catalogFreshnessUpdated}
                  </span>
                </div>
                <p>
                  {selectedCategory === "12" ? (lang === "ar" ? "طالبات" : "Female") : (lang === "ar" ? "طلاب" : "Male")} · {data.courses.length} {lang === "ar" ? "مقرر" : "courses"} · {data.sections.length} {lang === "ar" ? "شعبة" : "sections"} · {lang === "ar" ? `آخر تحديث: ${getRelativeTimeDescription(liveMetadata?.lastPublishedSnapshot || data.importedAt, undefined, lang)}` : `Updated ${getRelativeTimeDescription(liveMetadata?.lastPublishedSnapshot || data.importedAt)}`}
                </p>
                <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px", marginBottom: 0 }}>
                  ℹ️ {t.statusDialog.catalogPortalNote}
                </p>
                {freshnessInfo.isStale && (
                  <div
                    style={{
                      background: "rgba(235, 140, 0, 0.08)",
                      border: "1px solid rgba(235, 140, 0, 0.3)",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      marginTop: "10px",
                      fontSize: "13px",
                    }}
                  >
                    <strong>⚠️ {t.statusDialog.staleDataAlert(getRelativeTimeDescription(data.importedAt, undefined, lang))}</strong>
                  </div>
                )}
              </div>
            </div>

            <footer className="auth-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setStatusModalOpen(false)}
              >
                {t.common.close}
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmClearGuestOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmClearGuestOpen(false)}>
          <div
            className="auth-modal reset-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-guest-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="clear-guest-modal-title">🗑️ {t.planner.guestClearConfirmTitle}</h2>
                <p>{t.planner.guestClearConfirmMessage}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setConfirmClearGuestOpen(false)}
                aria-label={t.common.close}
              >
                <Icon name="x"/>
              </button>
            </header>
            <footer className="auth-modal-footer course-details-footer">
              <div className="course-details-actions">
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={handleConfirmClearGuest}
                >
                  {t.planner.guestClearButton}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setConfirmClearGuestOpen(false)}
                >
                  {t.common.cancel}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {guestImportModalOpen && user && (
        <div className="modal-backdrop" role="presentation" onClick={handleDismissGuestImport}>
          <div
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-import-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "520px" }}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="guest-import-modal-title">📥 {t.planner.guestImportModalTitle}</h2>
                <p>{t.planner.guestImportPromptDesc(unimportedGuestPlans.length || unimportedGuestPlansCount)}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={handleDismissGuestImport}
                aria-label={t.common.close}
              >
                <Icon name="x"/>
              </button>
            </header>

            <div className="status-modal-body" style={{ maxHeight: "300px", overflowY: "auto", padding: "10px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                {(unimportedGuestPlans.length ? unimportedGuestPlans : loadGuestPlans(window.localStorage)).map((gp, idx) => (
                  <div
                    key={gp.id || idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      background: "var(--card-bg, #fbfbf8)",
                      border: "1px solid var(--border, #e5e5dc)",
                    }}
                  >
                    <div>
                      <strong>{gp.name}</strong>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                        {gp.sectionIds.length} {gp.sectionIds.length === 1 ? t.planner.sectionUnit : t.planner.sectionsUnit}
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                      {formatDate(gp.updatedAt, lang)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: "1px solid var(--border, #e5e5dc)" }}>
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  💡 {lang === "ar" ? "يمكنك حفظ نسخة احتياطية من خطط الزائر:" : "Backup guest plans before importing:"}
                </span>
                <button
                  type="button"
                  className="ghost small"
                  onClick={handleExportGuestBackup}
                  title={t.planner.guestExportButton}
                >
                  💾 {t.planner.guestExportButton}
                </button>
              </div>
            </div>

            <footer className="auth-modal-footer course-details-footer">
              <div className="course-details-actions" style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-btn primary"
                  onClick={handleConfirmGuestImport}
                >
                  {t.planner.guestImportConfirmButton(unimportedGuestPlans.length || unimportedGuestPlansCount)}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={handleDismissGuestImport}
                >
                  {t.planner.guestImportDismissButton}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {notificationsModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setNotificationsModalOpen(false)}>
          <div
            className="auth-modal status-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="notifications-modal-title">{t.notifications.modalTitle}</h2>
                <p>{t.notifications.modalSubtitle}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setNotificationsModalOpen(false)}
                aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
              >
                <Icon name="x"/>
              </button>
            </header>

            <div className="status-modal-body">
              <div className="notification-actions-row" style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <strong>{t.notifications.inAppAlertsTitle(notifications.length)}</strong>
                <div style={{ display: "flex", gap: 8 }}>
                  {unreadNotificationsCount > 0 && (
                    <button type="button" className="ghost small" onClick={markAllNotificationsRead}>
                      {t.notifications.markAllRead}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button type="button" className="ghost small" onClick={clearNotifications}>
                      {t.notifications.clearAll}
                    </button>
                  )}
                </div>
              </div>

              {notifications.length === 0 ? (
                <div className="empty" style={{ padding: "16px 0", textAlign: "center" }}>
                  <Icon name="bell" />
                  <b>{t.notifications.allCaughtUpTitle}</b>
                  <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                    {t.notifications.allCaughtUpDesc}
                  </p>
                </div>
              ) : (
                <div className="notifications-list" style={{ maxHeight: 220, overflowY: "auto" }}>
                  {notifications.map((notif) => (
                    <div key={notif.id} className={`notification-item ${!notif.readAt ? "unread" : ""}`}>
                      <div className="notification-header">
                        <strong>{notif.title}</strong>
                        <span className="notification-time">{formatDate(notif.createdAt, lang)}</span>
                      </div>
                      <div className="notification-body">{notif.body}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="quiet-hours-box">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <strong style={{ fontSize: 12 }}>{t.notifications.webPushTitle}</strong>
                    <p style={{ fontSize: 11, color: "var(--muted)", margin: "2px 0 0" }}>
                      {t.notifications.webPushDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="admin-btn secondary small"
                    onClick={async () => {
                      if (typeof window === "undefined" || !("Notification" in window)) {
                        setToast(t.notifications.pushNotSupportedToast);
                        return;
                      }
                      if (Notification.permission === "granted") {
                        setPushEnabled(true);
                        setToast(t.notifications.pushAlreadyActiveToast);
                        return;
                      }
                      try {
                        const perm = await Notification.requestPermission();
                        if (perm === "granted") {
                          setPushEnabled(true);
                          setToast(t.notifications.pushEnabledToast);
                        } else {
                          setToast(t.notifications.pushDeniedToast);
                        }
                      } catch {
                        setToast(t.notifications.pushErrorToast);
                      }
                    }}
                  >
                    {pushEnabled ? t.notifications.pushActive : t.notifications.enablePush}
                  </button>
                </div>

                <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={quietHoursEnabled}
                      onChange={(e) => setQuietHoursEnabled(e.target.checked)}
                    />
                    <span>{t.notifications.quietHoursLabel}</span>
                  </label>

                  {quietHoursEnabled && (
                    <div className="quiet-hours-inputs">
                      <label>
                        <span>{t.notifications.quietHoursStart}</span>
                        <input
                          type="time"
                          value={quietHoursStart}
                          onChange={(e) => setQuietHoursStart(e.target.value)}
                          className="time-picker-input"
                        />
                      </label>
                      <label>
                        <span>{t.notifications.quietHoursEnd}</span>
                        <input
                          type="time"
                          value={quietHoursEnd}
                          onChange={(e) => setQuietHoursEnd(e.target.value)}
                          className="time-picker-input"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <footer className="auth-modal-footer">
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setNotificationsModalOpen(false)}
              >
                {t.common.close}
              </button>
            </footer>
          </div>
        </div>
      )}
      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        lang={lang}
        onLanguageChange={handleOnboardingLanguageChange}
        selectedCategory={onboardingCategory}
        onCategoryChange={handleOnboardingCategoryChange}
        onComplete={handleOnboardingComplete}
        t={t}
        maleSectionCount={maleSectionCount}
        femaleSectionCount={femaleSectionCount}
      />

      <RegistrationGuideModal
        isOpen={regGuideOpen}
        onClose={() => setRegGuideOpen(false)}
        lang={lang}
        t={t}
      />

      <CourseDetailsModal
        isOpen={selectedCalendarSection !== null}
        onClose={() => setSelectedCalendarSection(null)}
        section={selectedCalendarSection}
        course={selectedCalendarSection ? courseMap.get(selectedCalendarSection.courseId) ?? null : null}
        lang={lang}
        t={t}
        onRemoveSection={(sec) => {
          toggleSection(sec);
          setToast(t.courseDetails.confirmRemoveTitle);
        }}
        onCopyCrn={async (crn) => {
          try {
            await navigator.clipboard.writeText(crn);
            setToast(t.courseDetails.crnCopied);
          } catch {
            setToast(t.courseDetails.crnCopied);
          }
        }}
      />

      <DataPrivacyModal
        isOpen={dataPrivacyModalOpen}
        onClose={() => setDataPrivacyModalOpen(false)}
        lang={lang}
        t={t}
        currentPlans={plans}
        onRestoreSuccess={(restoredPlans, nextActiveId) => {
          setPlans(restoredPlans);
          if (nextActiveId) {
            setActivePlanId(nextActiveId);
          }
        }}
        onClearDataSuccess={() => {
          const freshPlan = newPlan(data.term.id, 1, lang);
          setPlans([freshPlan]);
          setActivePlanId(freshPlan.id);
        }}
        showToast={setToast}
      />

      {clearScheduleDialogOpen && activePlan && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            clearConfirmationInProgressRef.current = false;
            setClearScheduleDialogOpen(false);
          }}
        >
          <div
            className="auth-modal clear-schedule-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-schedule-title"
            aria-describedby="clear-schedule-message"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                clearConfirmationInProgressRef.current = false;
                setClearScheduleDialogOpen(false);
              }
            }}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="clear-schedule-title">{t.planner.clearScheduleDialogTitle}</h2>
                <p id="clear-schedule-message">{t.planner.clearScheduleDialogMessage}</p>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label={t.common.close}
                onClick={() => {
                  clearConfirmationInProgressRef.current = false;
                  setClearScheduleDialogOpen(false);
                }}
              >
                <Icon name="x" />
              </button>
            </header>
            <footer className="auth-modal-footer course-details-footer">
              <div className="course-details-actions">
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={clearScheduleFromActivePlan}
                >
                  {t.planner.clearScheduleConfirm}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => {
                    clearConfirmationInProgressRef.current = false;
                    setClearScheduleDialogOpen(false);
                  }}
                >
                  {t.common.cancel}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${clearUndoPlan ? "toast-with-action" : ""}`}>
          <span role="status">{toast}</span>
          {clearUndoPlan && (
            <button
              type="button"
              className="toast-action"
              aria-label={t.planner.clearScheduleUndo}
              onClick={undoClearSchedule}
            >
              {t.planner.clearScheduleUndo}
            </button>
          )}
        </div>
      )}
    </main>
  );
}
