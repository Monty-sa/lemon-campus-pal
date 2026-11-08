"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  calculateProjectedCumulativeGpa,
  calculateSemesterGpa,
  calculateTargetGpaFeasibility,
  GPA_SCENARIOS_STORAGE_KEY,
  KFU_GRADE_SCALE,
} from "@/lib/gpa/calculator";
import type {
  GpaCourseInput,
  KfuGradeLetter,
  SavedGpaScenario,
} from "@/lib/gpa/types";
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import {
  getLanguageDirection,
  getStoredLanguage,
  getTranslations,
  type Language,
  setStoredLanguage,
} from "@/lib/i18n";
import { allOfferings, maleOfferings } from "@/data/offerings";
import { getLocalizedCourseTitle } from "@/lib/i18n/course-titles";
import {
  getActiveGpaDraftKey,
  getActiveGpaScenariosKey,
  GUEST_GPA_DRAFT_KEY,
  GUEST_GPA_SCENARIOS_KEY,
  loadActivePlanId,
  loadGuestPlans,
  loadPlans,
  loadSavedCategory,
  loadUserPlans,
  PLANS_OWNER_STORAGE_KEY,
} from "@/lib/storage";

const GRADE_OPTIONS: KfuGradeLetter[] = [
  "A+", "A", "B+", "B", "C+", "C", "D+", "D", "F", "DN",
  "NP", "NF", "IC", "IP", "W", "AU",
];

export const GPA_DRAFT_STORAGE_KEY = "lemon.gpa-draft.v1";

interface GpaDraftState {
  prevHours?: number | "";
  prevGpa?: number | "";
  targetGpa?: number | "";
  courses?: GpaCourseInput[];
}

function loadStoredGpaDraft(): GpaDraftState | null {
  if (typeof window === "undefined") return null;
  try {
    const key = getActiveGpaDraftKey(window.localStorage);
    let raw = window.localStorage.getItem(key);
    if (!raw && key === GUEST_GPA_DRAFT_KEY) {
      raw = window.localStorage.getItem(GPA_DRAFT_STORAGE_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // Gracefully handle storage errors
  }
  return null;
}

function loadStoredGpaScenarios(): SavedGpaScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const key = getActiveGpaScenariosKey(window.localStorage);
    let raw = window.localStorage.getItem(key);
    if (!raw && key === GUEST_GPA_SCENARIOS_KEY) {
      raw = window.localStorage.getItem(GPA_SCENARIOS_STORAGE_KEY);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(value)) return value;
  } catch {
    // Storage can be restricted
  }
  return "system";
}

export default function GpaPage() {
  const hydrated = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredTheme());
  const [lang, setLang] = useState<Language>(() => getStoredLanguage());
  const t = useMemo(() => getTranslations(lang), [lang]);

  // Clean empty initial state or loaded draft
  const initialDraft = useMemo(() => (typeof window !== "undefined" ? loadStoredGpaDraft() : null), []);

  const [prevHours, setPrevHours] = useState<number | "">(() => initialDraft?.prevHours ?? "");
  const [prevGpa, setPrevGpa] = useState<number | "">(() => initialDraft?.prevGpa ?? "");
  const [targetGpa, setTargetGpa] = useState<number | "">(() => initialDraft?.targetGpa ?? "");
  const [courses, setCourses] = useState<GpaCourseInput[]>(() => initialDraft?.courses ?? []);

  // Saved scenarios
  const [scenarios, setScenarios] = useState<SavedGpaScenario[]>(() => {
    if (typeof window === "undefined") return [];
    return loadStoredGpaScenarios();
  });
  const [scenarioName, setScenarioName] = useState("");
  const [toast, setToast] = useState("");
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importCandidateCourses, setImportCandidateCourses] = useState<GpaCourseInput[]>([]);
  const [importPlanName, setImportPlanName] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "merge">("replace");

  // Sync theme
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
      // Storage restricted
    }
    if (!media) return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [hydrated, theme]);

  // Sync language and direction
  useEffect(() => {
    if (!hydrated) return;
    setStoredLanguage(lang);
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("dir", getLanguageDirection(lang));
  }, [hydrated, lang]);

  // Persist draft calculations automatically
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      const activeKey = getActiveGpaDraftKey(window.localStorage);
      const hasData =
        prevHours !== "" ||
        prevGpa !== "" ||
        targetGpa !== "" ||
        courses.length > 0;

      if (hasData) {
        window.localStorage.setItem(
          activeKey,
          JSON.stringify({ prevHours, prevGpa, targetGpa, courses }),
        );
      } else {
        window.localStorage.removeItem(activeKey);
      }
    } catch {
      // Storage restricted
    }
  }, [hydrated, prevHours, prevGpa, targetGpa, courses]);

  // Toast auto-clear
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Calculations
  const semesterResult = useMemo(() => {
    return calculateSemesterGpa(courses);
  }, [courses]);

  const numPrevHours = typeof prevHours === "number" && !Number.isNaN(prevHours) ? Math.max(0, prevHours) : 0;
  const numPrevGpa = typeof prevGpa === "number" && !Number.isNaN(prevGpa) ? Math.max(0, prevGpa) : 0;
  const numTargetGpa = typeof targetGpa === "number" && !Number.isNaN(targetGpa) ? Math.max(0, targetGpa) : 0;

  const cumulativeResult = useMemo(() => {
    return calculateProjectedCumulativeGpa(
      { previousHours: numPrevHours, previousGpa: numPrevGpa },
      semesterResult,
    );
  }, [numPrevHours, numPrevGpa, semesterResult]);

  const feasibilityResult = useMemo(() => {
    return calculateTargetGpaFeasibility(
      { previousHours: numPrevHours, previousGpa: numPrevGpa },
      semesterResult.gpaCredits,
      numTargetGpa,
    );
  }, [numPrevHours, numPrevGpa, semesterResult.gpaCredits, numTargetGpa]);

  const isCalculationEmpty =
    courses.length === 0 &&
    prevHours === "" &&
    prevGpa === "" &&
    targetGpa === "";

  function handleCourseChange<K extends keyof GpaCourseInput>(id: string, field: K, val: GpaCourseInput[K]) {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    );
  }

  function addCourse() {
    const nextIdx = courses.length + 1;
    setCourses((prev) => [
      ...prev,
      { id: `c-${Date.now()}-${nextIdx}`, code: `Course ${nextIdx}`, credits: 3, grade: "A+" },
    ]);
  }

  function removeCourse(id: string) {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  }

  function handleResetClick() {
    if (isCalculationEmpty) {
      // Nothing entered to clear; avoid asking for confirmation
      return;
    }
    setConfirmResetOpen(true);
  }

  function performReset() {
    setCourses([]);
    setPrevHours("");
    setPrevGpa("");
    setTargetGpa("");
    if (typeof window !== "undefined") {
      try {
        const key = getActiveGpaDraftKey(window.localStorage);
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(GPA_DRAFT_STORAGE_KEY);
      } catch {
        // Storage restricted
      }
    }
    setConfirmResetOpen(false);
    setToast(t.gpa.calculatorResetToast);
  }

  function saveCurrentScenario() {
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    const newScen: SavedGpaScenario = {
      id: `scen-${Date.now()}`,
      name,
      previousGpa: numPrevGpa,
      previousHours: numPrevHours,
      courses,
      updatedAt: new Date().toISOString(),
    };
    const updated = [newScen, ...scenarios.slice(0, 19)];
    setScenarios(updated);
    if (typeof window !== "undefined") {
      const activeKey = getActiveGpaScenariosKey(window.localStorage);
      window.localStorage.setItem(activeKey, JSON.stringify(updated));
    }
    setScenarioName("");
    setToast(t.gpa.savedToast(name));
  }

  function loadScenario(scen: SavedGpaScenario) {
    setPrevGpa(scen.previousGpa > 0 ? scen.previousGpa : "");
    setPrevHours(scen.previousHours > 0 ? scen.previousHours : "");
    setCourses(scen.courses);
    setToast(t.gpa.loadedToast(scen.name));
  }

  function deleteScenario(id: string) {
    const updated = scenarios.filter((s) => s.id !== id);
    setScenarios(updated);
    if (typeof window !== "undefined") {
      const activeKey = getActiveGpaScenariosKey(window.localStorage);
      window.localStorage.setItem(activeKey, JSON.stringify(updated));
    }
    setToast(t.gpa.removedToast);
  }

  function handleImportClick() {
    if (typeof window === "undefined") return;
    const owner = window.localStorage.getItem(PLANS_OWNER_STORAGE_KEY);
    let plans = [];
    let activePlanId: string | null = null;

    if (owner?.startsWith("user:")) {
      const userId = owner.replace("user:", "");
      plans = loadUserPlans(window.localStorage, userId);
      activePlanId = loadActivePlanId(window.localStorage, userId);
    } else {
      plans = loadGuestPlans(window.localStorage);
      if (!plans.length) {
        plans = loadPlans(window.localStorage);
      }
      activePlanId = loadActivePlanId(window.localStorage, null);
    }

    const activePlan = plans.find((p) => p.id === activePlanId) || plans[0];
    if (!activePlan || !activePlan.sectionIds || activePlan.sectionIds.length === 0) {
      setToast(t.gpa.noCoursesInPlan);
      return;
    }

    const category = loadSavedCategory(window.localStorage) ?? "11";
    const primaryOfferings = allOfferings[category] ?? maleOfferings;
    const otherCategory = category === "11" ? "12" : "11";
    const fallbackOfferings = allOfferings[otherCategory];

    // Map section IDs to unique courses
    const uniqueCourseMap = new Map<string, GpaCourseInput>();

    for (const secId of activePlan.sectionIds) {
      const section =
        primaryOfferings.sections.find((s) => s.id === secId || s.crn === secId) ||
        fallbackOfferings?.sections.find((s) => s.id === secId || s.crn === secId);

      if (!section) continue;

      const course =
        primaryOfferings.courses.find((c) => c.id === section.courseId) ||
        fallbackOfferings?.courses.find((c) => c.id === section.courseId);

      if (!course) continue;

      const courseKey = course.code || course.id;
      if (!uniqueCourseMap.has(courseKey)) {
        const localized = getLocalizedCourseTitle(course, lang);
        const title = localized.title || course.titleAr || course.code;
        uniqueCourseMap.set(courseKey, {
          id: `imp-${course.id}-${Date.now()}-${uniqueCourseMap.size + 1}`,
          code: `${course.code} - ${title}`,
          title,
          credits: course.credits || 3,
          grade: "",
        });
      }
    }

    const importedList = Array.from(uniqueCourseMap.values());
    if (importedList.length === 0) {
      setToast(t.gpa.noCoursesInPlan);
      return;
    }

    if (courses.length === 0) {
      setCourses(importedList);
      setToast(t.gpa.importSuccessToast(importedList.length));
    } else {
      setImportCandidateCourses(importedList);
      setImportPlanName(activePlan.name);
      setImportMode("replace");
      setImportModalOpen(true);
    }
  }

  function confirmImport() {
    if (importMode === "replace") {
      setCourses(importCandidateCourses);
    } else {
      const existingCodes = new Set(courses.map((c) => c.code.split(" - ")[0].trim()));
      const newCourses = importCandidateCourses.filter(
        (c) => !existingCodes.has(c.code.split(" - ")[0].trim()),
      );
      setCourses((prev) => [...prev, ...newCourses]);
    }
    setImportModalOpen(false);
    setToast(t.gpa.importSuccessToast(importCandidateCourses.length));
  }

  if (!hydrated) {
    return <main className="loading"><span className="lemon-mark">L</span><p>{t.common.loading}</p></main>;
  }

  return (
    <main dir={getLanguageDirection(lang)} lang={lang} className="gpa-page">
      <header className="topbar">
        <Link href="/" className="brand" aria-label={lang === "ar" ? "ليمون الرئيسية" : "LEMON home"}>
          <span className="brand-fruit"><span>LE</span><b>MON</b></span>
          <span className="brand-tag">{t.common.brandTag}</span>
        </Link>
        <div className="source-pill">
          <span>{t.gpa.officialBadge}</span>
        </div>
        <Link href="/" className="admin-nav-link" title={t.gpa.returnToPlanner}>
          {t.gpa.returnToPlanner}
        </Link>
        <div className="theme-switcher" role="group" aria-label={t.common.theme}>
          <button
            type="button"
            className={theme === "light" ? "active" : ""}
            onClick={() => setTheme("light")}
            aria-pressed={theme === "light"}
            title={t.common.lightTheme}
          >
            {t.common.lightTheme}
          </button>
          <button
            type="button"
            className={theme === "dark" ? "active" : ""}
            onClick={() => setTheme("dark")}
            aria-pressed={theme === "dark"}
            title={t.common.darkTheme}
          >
            {t.common.darkTheme}
          </button>
          <button
            type="button"
            className={theme === "system" ? "active" : ""}
            onClick={() => setTheme("system")}
            aria-pressed={theme === "system"}
            title={t.common.systemTheme}
          >
            {t.common.systemTheme}
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
      </header>

      <div className="gpa-container">
        <section className="gpa-hero">
          <h1>{t.common.gpaCalculatorNav}</h1>
          <p>{t.gpa.subtitle}</p>
        </section>

        <div className="gpa-summary-grid">
          {/* Semester GPA */}
          <div className="gpa-metric-card highlight">
            <span className="gpa-metric-label">{t.gpa.semesterGpa}</span>
            <strong className="gpa-metric-val">
              <bdi dir="ltr">{semesterResult.gpaCredits > 0 ? semesterResult.gpa.toFixed(2) : "—"}</bdi>
            </strong>
            <span className={`gpa-standing-pill ${semesterResult.gpaCredits > 0 ? "" : "neutral"}`}>
              {semesterResult.gpaCredits > 0
                ? lang === "ar"
                  ? semesterResult.academicStandingAr
                  : semesterResult.academicStandingEn
                : lang === "ar"
                ? "في الانتظار"
                : "Pending"}
            </span>
            <small>
              {semesterResult.gpaCredits > 0
                ? t.gpa.gpaCreditsAndPoints(semesterResult.gpaCredits, semesterResult.qualityPoints)
                : t.gpa.emptyCoursesState}
            </small>
          </div>

          {/* Cumulative GPA */}
          <div className="gpa-metric-card">
            <span className="gpa-metric-label">{t.gpa.cumulativeGpa}</span>
            <strong className="gpa-metric-val">
              <bdi dir="ltr">
                {cumulativeResult.totalHours > 0 ? cumulativeResult.cumulativeGpa.toFixed(2) : "—"}
              </bdi>
            </strong>
            <span className={`gpa-standing-pill ${cumulativeResult.totalHours > 0 ? "" : "neutral"}`}>
              {cumulativeResult.totalHours > 0
                ? lang === "ar"
                  ? cumulativeResult.academicStandingAr
                  : cumulativeResult.academicStandingEn
                : lang === "ar"
                ? "في الانتظار"
                : "Pending"}
            </span>
            <small>
              {cumulativeResult.totalHours > 0
                ? t.gpa.cumulativeChangeInfo(
                    cumulativeResult.gpaChange >= 0
                      ? `+${cumulativeResult.gpaChange.toFixed(2)}`
                      : cumulativeResult.gpaChange.toFixed(2),
                    cumulativeResult.totalHours,
                  )
                : t.gpa.emptyHistoryState}
            </small>
          </div>

          {/* Target Feasibility */}
          <div
            className={`gpa-metric-card ${
              numTargetGpa > 0 ? `feasibility-${feasibilityResult.feasibilityStatus}` : ""
            }`}
          >
            <span className="gpa-metric-label">
              {t.gpa.targetFeasibilityTitle(numTargetGpa > 0 ? numTargetGpa.toFixed(2) : "—")}
            </span>
            <strong className="gpa-metric-val">
              {numTargetGpa > 0 ? (
                feasibilityResult.isFeasible ? (
                  <>
                    <bdi dir="ltr">{feasibilityResult.requiredSemesterGpa.toFixed(2)}</bdi> {t.gpa.reqAbbrev}
                  </>
                ) : (
                  t.gpa.impossibleStatus
                )
              ) : (
                "—"
              )}
            </strong>
            <span className={`gpa-standing-pill ${numTargetGpa > 0 ? "" : "neutral"}`}>
              {numTargetGpa > 0
                ? feasibilityResult.isFeasible
                  ? t.gpa.feasiblePill
                  : t.gpa.outOfReachPill
                : lang === "ar"
                ? "في الانتظار"
                : "Pending"}
            </span>
            <small>
              {numTargetGpa > 0
                ? lang === "ar"
                  ? feasibilityResult.messageAr
                  : feasibilityResult.messageEn
                : t.gpa.emptyTargetPrompt}
            </small>
          </div>
        </div>

        <div className="gpa-main-layout">
          <section className="gpa-panel">
            <div className="panel-header">
              <h2>{t.gpa.currentSemesterCourses}</h2>
              <div className="panel-header-actions">
                <button
                  type="button"
                  className="ghost small reset-calc-btn"
                  onClick={handleResetClick}
                  title={t.gpa.resetCalculator}
                  aria-label={t.gpa.resetCalculator}
                >
                  🔄 {t.gpa.resetCalculator}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary small import-schedule-btn"
                  onClick={handleImportClick}
                  title={t.gpa.importFromSchedule}
                  aria-label={t.gpa.importFromSchedule}
                >
                  📅 {t.gpa.importFromSchedule}
                </button>
                <button type="button" className="admin-btn primary small" onClick={addCourse}>
                  {t.gpa.addCourse}
                </button>
              </div>
            </div>

            <div className="gpa-table-wrap">
              <table className="gpa-table">
                <thead>
                  <tr>
                    <th scope="col">{t.gpa.tableColCourse}</th>
                    <th scope="col" style={{ width: 110 }}>{t.gpa.tableColCredits}</th>
                    <th scope="col" style={{ width: 180 }}>{t.gpa.tableColGrade}</th>
                    <th scope="col" style={{ width: 100 }}>{t.gpa.tableColPoints}</th>
                    <th scope="col" style={{ width: 70 }}>{t.gpa.tableColAction}</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-courses-cell">
                        <div className="empty-courses-content">
                          <span>📚</span>
                          <p>{t.gpa.emptyCoursesState}</p>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginTop: "8px" }}>
                            <button type="button" className="admin-btn primary small" onClick={addCourse}>
                              {t.gpa.addCourse}
                            </button>
                            <button type="button" className="admin-btn secondary small" onClick={handleImportClick}>
                              📅 {t.gpa.importFromSchedule}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    courses.map((course) => {
                      const gradeDef = course.grade ? KFU_GRADE_SCALE[course.grade] : null;
                      const pts =
                        gradeDef?.points !== null && gradeDef?.points !== undefined
                          ? (course.credits * gradeDef.points).toFixed(2)
                          : "—";

                      return (
                        <tr key={course.id}>
                          <td>
                            <input
                              type="text"
                              value={course.code}
                              onChange={(e) => handleCourseChange(course.id, "code", e.target.value)}
                              placeholder={t.gpa.courseNamePlaceholder}
                              className="gpa-input-text"
                              aria-label="Course name"
                            />
                          </td>
                          <td>
                            <select
                              value={course.credits}
                              onChange={(e) => handleCourseChange(course.id, "credits", Number(e.target.value))}
                              className="gpa-select"
                              aria-label="Course credits"
                            >
                              {[0, 1, 2, 3, 4, 5, 6].map((cr) => (
                                <option key={cr} value={cr}>
                                  {t.gpa.creditUnit(cr)}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              value={course.grade}
                              onChange={(e) => handleCourseChange(course.id, "grade", e.target.value as KfuGradeLetter)}
                              className="gpa-select"
                              aria-label="Course grade"
                            >
                              <option value="">{lang === "ar" ? "اختر الدرجة (توقعك)" : "Select grade (projected)"}</option>
                              {GRADE_OPTIONS.map((letter) => {
                                const def = KFU_GRADE_SCALE[letter];
                                return (
                                  <option key={letter} value={letter}>
                                    {letter} ({def.points !== null ? def.points.toFixed(2) : "—"}) - {lang === "ar" ? def.labelAr : def.labelEn}
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td>
                            <span className="pts-badge"><bdi dir="ltr">{pts}</bdi></span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="delete-row-btn"
                              onClick={() => removeCourse(course.id)}
                              aria-label={`Delete ${course.code}`}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="scale-legend">
              <span className="legend-title">{t.gpa.kfuScaleLegendTitle}</span>
              <span className="legend-item"><bdi dir="ltr">A+ = 5.00</bdi></span>
              <span className="legend-item"><bdi dir="ltr">A = 4.75</bdi></span>
              <span className="legend-item"><bdi dir="ltr">B+ = 4.50</bdi></span>
              <span className="legend-item"><bdi dir="ltr">B = 4.00</bdi></span>
              <span className="legend-item"><bdi dir="ltr">C+ = 3.50</bdi></span>
              <span className="legend-item"><bdi dir="ltr">C = 3.00</bdi></span>
              <span className="legend-item"><bdi dir="ltr">D+ = 2.50</bdi></span>
              <span className="legend-item"><bdi dir="ltr">D = 2.00</bdi></span>
              <span className="legend-item"><bdi dir="ltr">F / DN = 1.00</bdi></span>
            </div>
          </section>

          <aside className="gpa-sidebar">
            <div className="sidebar-card">
              <h3>{t.gpa.previousHistory} 📈</h3>
              <p>{t.gpa.priorHistorySubtitle}</p>
              <div className="input-field">
                <label htmlFor="prev-gpa">{t.gpa.priorGpaLabel}</label>
                <input
                  id="prev-gpa"
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.01"
                  value={prevGpa}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setPrevGpa(val);
                  }}
                  className="gpa-num-input"
                  placeholder="e.g. 4.00"
                />
              </div>
              <div className="input-field">
                <label htmlFor="prev-hours">{t.gpa.priorHoursLabel}</label>
                <input
                  id="prev-hours"
                  type="number"
                  min="0"
                  max="250"
                  step="1"
                  value={prevHours}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setPrevHours(val);
                  }}
                  className="gpa-num-input"
                  placeholder="e.g. 30"
                />
              </div>
            </div>

            <div className="sidebar-card">
              <h3>{t.gpa.targetPlanner} 🎯</h3>
              <p>{t.gpa.targetSubtitle}</p>
              <div className="input-field">
                <label htmlFor="target-gpa">{t.gpa.targetGpaLabel}</label>
                <input
                  id="target-gpa"
                  type="number"
                  min="1.0"
                  max="5.0"
                  step="0.01"
                  value={targetGpa}
                  onChange={(e) => {
                    const val = e.target.value === "" ? "" : Number(e.target.value);
                    setTargetGpa(val);
                  }}
                  className="gpa-num-input"
                  placeholder="e.g. 4.25"
                />
              </div>
              <div
                className={`feasibility-box ${
                  numTargetGpa > 0 ? `feasibility-${feasibilityResult.feasibilityStatus}` : ""
                }`}
              >
                <strong>{t.gpa.statusLabel}</strong>{" "}
                {numTargetGpa > 0
                  ? lang === "ar"
                    ? feasibilityResult.messageAr
                    : feasibilityResult.messageEn
                  : t.gpa.emptyTargetPrompt}
              </div>
            </div>

            <div className="sidebar-card">
              <h3>{t.gpa.saveScenario}</h3>
              <p>{t.gpa.saveScenarioSubtitle}</p>
              <div className="scenario-save-row">
                <input
                  type="text"
                  placeholder={t.gpa.scenarioNamePlaceholder}
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="gpa-input-text"
                  maxLength={40}
                />
                <button type="button" className="admin-btn primary small" onClick={saveCurrentScenario}>
                  {t.common.save}
                </button>
              </div>

              {scenarios.length > 0 && (
                <div className="saved-scenarios-list">
                  <span className="saved-scenarios-title">{t.gpa.savedScenariosCountTitle(scenarios.length)}</span>
                  {scenarios.map((scen) => (
                    <div key={scen.id} className="scenario-pill">
                      <button
                        type="button"
                        className="scenario-load-btn"
                        onClick={() => loadScenario(scen)}
                        title={`Load ${scen.name}`}
                      >
                        {scen.name}
                      </button>
                      <button
                        type="button"
                        className="scenario-del-btn"
                        onClick={() => deleteScenario(scen.id)}
                        aria-label={`Delete ${scen.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {confirmResetOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setConfirmResetOpen(false)}>
          <div
            className="auth-modal gpa-reset-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="reset-modal-title">{t.gpa.resetConfirmationTitle}</h2>
                <p>{t.gpa.resetConfirmationMessage}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setConfirmResetOpen(false)}
                aria-label={t.common.close}
              >
                ✕
              </button>
            </header>
            <footer className="auth-modal-footer course-details-footer">
              <div className="course-details-actions">
                <button
                  type="button"
                  className="admin-btn danger"
                  onClick={performReset}
                >
                  {t.gpa.resetConfirmationConfirm}
                </button>
                <button
                  type="button"
                  className="admin-btn secondary"
                  onClick={() => setConfirmResetOpen(false)}
                >
                  {t.gpa.resetConfirmationCancel}
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setImportModalOpen(false)}>
          <div
            className="auth-modal gpa-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gpa-import-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="auth-modal-header">
              <div>
                <h2 id="gpa-import-title">📅 {t.gpa.importModalTitle}</h2>
                <p>{t.gpa.importModalDesc(importCandidateCourses.length, importPlanName)}</p>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setImportModalOpen(false)}
                aria-label={lang === "ar" ? "إغلاق النافذة" : "Close dialog"}
              >
                ✕
              </button>
            </header>

            <div className="auth-modal-body" style={{ padding: "16px 20px" }}>
              <div
                className="gpa-import-options"
                role="radiogroup"
                aria-label={t.gpa.importModalTitle}
                style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                  />
                  <span>{t.gpa.importOptionReplace}</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px" }}>
                  <input
                    type="radio"
                    name="import-mode"
                    value="merge"
                    checked={importMode === "merge"}
                    onChange={() => setImportMode("merge")}
                  />
                  <span>{t.gpa.importOptionMerge}</span>
                </label>
              </div>

              <div
                className="gpa-import-preview"
                style={{
                  maxHeight: "180px",
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  background: "var(--card-bg, #fbfdf9)",
                }}
              >
                <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px" }}>
                  {lang === "ar" ? "المقررات المستوردة وساعاتها المعتمدة:" : "Unique courses to import (credit hours):"}
                </strong>
                <ul style={{ margin: 0, paddingInlineStart: "20px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {importCandidateCourses.map((c) => (
                    <li key={c.id}>
                      {c.code} — <b>{t.gpa.creditUnit(c.credits)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <footer className="auth-modal-footer" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", padding: "14px 20px" }}>
              <button
                type="button"
                className="admin-btn secondary"
                onClick={() => setImportModalOpen(false)}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="admin-btn primary"
                onClick={confirmImport}
              >
                {t.gpa.importConfirmButton(importCandidateCourses.length)}
              </button>
            </footer>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
