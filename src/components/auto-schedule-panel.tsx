"use client";

import { useId, useMemo, useState } from "react";
import type { Course, DataImport, Day, SchedulePlan, Section, SectionMeeting } from "@/lib/schema";
import {
  DEFAULT_AUTO_SCHEDULE_PREFERENCES,
  generateSchedules,
  type AutoSchedulePreferences,
  type GeneratedSchedule,
} from "@/lib/auto-schedule";
import { formatTime } from "@/lib/schedule";
import { getLocalizedCourseTitle, getTranslations, type Language, type Translations } from "@/lib/i18n";
import { normalizeSearchText } from "@/lib/search-normalizer";
import { getDepartmentLabel } from "@/lib/explorer-filters";

const ALL_DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu"];

export function localizeScheduleReason(reason: string, lang: Language): string {
  if (lang !== "ar") return reason;
  const number = (value: string) => new Intl.NumberFormat("ar-SA").format(Number(value));
  const days = reason.match(/^(\d+) campus days$/);
  if (days) return `${number(days[1])} أيام دوام`;
  const instructors = reason.match(/^(\d+) preferred instructor match(?:es)?$/);
  if (instructors) return `${number(instructors[1])} تطابق مع أستاذ مفضّل`;
  if (reason === "Preferred start time met") return "وقت البدء المفضّل";
  if (reason === "Gaps minimized") return "تقليل الفجوات بين المحاضرات";
  return reason;
}

const EARLIEST_START_CHOICES = [
  { value: null, labelEn: "No limit", labelAr: "بدون حد" },
  { value: 420, labelEn: "07:00 AM", labelAr: "07:00 ص" },
  { value: 480, labelEn: "08:00 AM", labelAr: "08:00 ص" },
  { value: 540, labelEn: "09:00 AM", labelAr: "09:00 ص" },
  { value: 600, labelEn: "10:00 AM", labelAr: "10:00 ص" },
  { value: 660, labelEn: "11:00 AM", labelAr: "11:00 ص" },
  { value: 720, labelEn: "12:00 PM", labelAr: "12:00 م" },
];

const LATEST_END_CHOICES = [
  { value: null, labelEn: "No limit", labelAr: "بدون حد" },
  { value: 720, labelEn: "12:00 PM", labelAr: "12:00 م" },
  { value: 780, labelEn: "01:00 PM", labelAr: "01:00 م" },
  { value: 840, labelEn: "02:00 PM", labelAr: "02:00 م" },
  { value: 900, labelEn: "03:00 PM", labelAr: "03:00 م" },
  { value: 960, labelEn: "04:00 PM", labelAr: "04:00 م" },
  { value: 1020, labelEn: "05:00 PM", labelAr: "05:00 م" },
  { value: 1080, labelEn: "06:00 PM", labelAr: "06:00 م" },
  { value: 1140, labelEn: "07:00 PM", labelAr: "07:00 م" },
  { value: 1200, labelEn: "08:00 PM", labelAr: "08:00 م" },
];

const PREFERRED_START_CHOICES = [
  { value: null, labelEn: "No preference", labelAr: "بدون تفضيل" },
  { value: 480, labelEn: "08:00 AM", labelAr: "08:00 ص" },
  { value: 540, labelEn: "09:00 AM (Default)", labelAr: "09:00 ص (الافتراضي)" },
  { value: 600, labelEn: "10:00 AM", labelAr: "10:00 ص" },
  { value: 660, labelEn: "11:00 AM", labelAr: "11:00 ص" },
  { value: 720, labelEn: "12:00 PM", labelAr: "12:00 م" },
];

function AutoIcon({ name }: { name: "spark" | "search" | "check" | "x" | "trash" | "calendar" | "clock" | "sliders" | "shield" | "chevronDown" | "chevronUp" | "plus" | "save" }) {
  switch (name) {
    case "spark":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
        </svg>
      );
    case "search":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
      );
    case "check":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "x":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case "trash":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case "calendar":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case "clock":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "sliders":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="20" y1="21" y2="21" /><line x1="4" x2="20" y1="14" y2="14" /><line x1="4" x2="20" y1="7" y2="7" />
          <circle cx="14" cy="21" r="2" /><circle cx="8" cy="14" r="2" /><circle cx="16" cy="7" r="2" />
        </svg>
      );
    case "shield":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "chevronDown":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case "chevronUp":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m18 15-6-6-6 6" />
        </svg>
      );
    case "plus":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "save":
      return (
        <svg aria-hidden="true" className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      );
  }
}

export interface AutoSchedulePanelProps {
  data: DataImport;
  lang: Language;
  onSave: (plan: SchedulePlan) => void;
  t?: Translations;
}

export function AutoSchedulePanel({ data, lang, onSave, t: externalTranslations }: AutoSchedulePanelProps) {
  const t = useMemo(() => externalTranslations ?? getTranslations(lang), [externalTranslations, lang]);
  const ar = lang === "ar";

  const [selected, setSelected] = useState<string[]>([]);
  const [courseSearch, setCourseSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState<AutoSchedulePreferences>(DEFAULT_AUTO_SCHEDULE_PREFERENCES);
  const [results, setResults] = useState<GeneratedSchedule[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [plansCreatedCount, setPlansCreatedCount] = useState(0);
  const [savedPlanKeys, setSavedPlanKeys] = useState<Set<string>>(new Set());
  const [customPlanNames, setCustomPlanNames] = useState<Record<number, string>>({});
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  const searchInputId = useId();

  const courses = useMemo(() => data.courses, [data.courses]);
  const sections = useMemo(() => data.sections, [data.sections]);

  const courseMap = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections]);

  // Extract unique departments and course counts
  const departmentOptions = useMemo(() => {
    const deptCounts = new Map<string, number>();
    for (const c of courses) {
      const d = c.departmentId ?? c.code.split("-")[0] ?? "other";
      deptCounts.set(d, (deptCounts.get(d) ?? 0) + 1);
    }
    return [...deptCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([id, count]) => ({
        id,
        label: getDepartmentLabel(id, lang),
        count,
      }));
  }, [courses, lang]);

  // Count sections per course for helpful feedback
  const sectionCountsByCourse = useMemo(() => {
    const counts = new Map<string, number>();
    for (const sec of sections) {
      if (sec.termId === data.term.id) {
        counts.set(sec.courseId, (counts.get(sec.courseId) ?? 0) + 1);
      }
    }
    return counts;
  }, [sections, data.term.id]);

  // Assess course scheduling eligibility (distinguishing catalog visibility from generation eligibility)
  const courseEligibility = useMemo(() => {
    const map = new Map<
      string,
      {
        totalSections: number;
        openSections: number;
        sectionsWithMeetings: number;
        statusReason: "eligible" | "no-times" | "snapshot-closed" | "no-sections";
      }
    >();

    for (const c of courses) {
      const courseSecs = sections.filter((s) => s.courseId === c.id && s.termId === data.term.id);
      const totalSections = courseSecs.length;
      const sectionsWithMeetings = courseSecs.filter((s) => s.meetings && s.meetings.length > 0).length;
      const openSections = courseSecs.filter(
        (s) => s.status === "open" && s.meetings && s.meetings.length > 0
      ).length;

      let statusReason: "eligible" | "no-times" | "snapshot-closed" | "no-sections" = "eligible";
      if (totalSections === 0) {
        statusReason = "no-sections";
      } else if (sectionsWithMeetings === 0) {
        statusReason = "no-times";
      } else if (openSections === 0) {
        statusReason = "snapshot-closed";
      }

      map.set(c.id, {
        totalSections,
        openSections,
        sectionsWithMeetings,
        statusReason,
      });
    }
    return map;
  }, [courses, sections, data.term.id]);

  // Filter courses by department and search input without arbitrary slicing
  const filteredCourses = useMemo(() => {
    const q = normalizeSearchText(courseSearch.trim().toLowerCase());
    return courses.filter((c) => {
      const deptId = c.departmentId ?? c.code.split("-")[0] ?? "other";
      if (deptFilter !== "all" && deptId !== deptFilter) return false;
      if (!q) return true;
      const codeMatch = normalizeSearchText(c.code.toLowerCase()).includes(q);
      const arMatch = normalizeSearchText(c.titleAr).includes(q);
      const enTitle = getLocalizedCourseTitle(c, "en").title;
      const enMatch = normalizeSearchText(enTitle.toLowerCase()).includes(q);
      return codeMatch || arMatch || enMatch;
    });
  }, [courses, courseSearch, deptFilter]);

  // Day chip names: short label inside chip to prevent collision with full timetable header
  const dayLabels = useMemo(
    (): Record<Day, { chip: string; aria: string }> => ({
      sun: { chip: ar ? "أحد" : "Sun", aria: ar ? "الأحد" : "Sunday" },
      mon: { chip: ar ? "إثنين" : "Mon", aria: ar ? "الاثنين" : "Monday" },
      tue: { chip: ar ? "ثلاثاء" : "Tue", aria: ar ? "الثلاثاء" : "Tuesday" },
      wed: { chip: ar ? "أربعاء" : "Wed", aria: ar ? "الأربعاء" : "Wednesday" },
      thu: { chip: ar ? "خميس" : "Thu", aria: ar ? "الخميس" : "Thursday" },
      fri: { chip: ar ? "جمعة" : "Fri", aria: ar ? "الجمعة" : "Friday" },
      sat: { chip: ar ? "سبت" : "Sat", aria: ar ? "السبت" : "Saturday" },
    }),
    [ar]
  );

  // Available instructors from selected courses
  const availableInstructors = useMemo(() => {
    const names = new Set<string>();
    for (const sec of sections) {
      if (selected.includes(sec.courseId) && sec.instructor?.name?.trim()) {
        names.add(sec.instructor.name.trim());
      }
    }
    return [...names].sort();
  }, [sections, selected]);

  function toggleCourse(courseId: string) {
    setSelected((current) =>
      current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId]
    );
  }

  function removeCourse(courseId: string) {
    setSelected((current) => current.filter((id) => id !== courseId));
  }

  function clearAllCourses() {
    setSelected([]);
    setResults([]);
    setHasMore(false);
    setMessage("");
  }

  function updatePrefs(patch: Partial<AutoSchedulePreferences>) {
    setPrefs((current) => ({ ...current, ...patch }));
  }

  function resetPreferences() {
    setPrefs(DEFAULT_AUTO_SCHEDULE_PREFERENCES);
    setToastMessage(ar ? "تمت استعادة الإعدادات الافتراضية" : "Preferences reset to defaults");
    setTimeout(() => setToastMessage(null), 2500);
  }

  function toggleDayOff(day: Day) {
    const isOff = prefs.hardDaysOff.includes(day);
    const updated = isOff ? prefs.hardDaysOff.filter((d) => d !== day) : [...prefs.hardDaysOff, day];
    updatePrefs({ hardDaysOff: updated });
  }

  function toggleInstructor(instructorName: string) {
    const isPicked = prefs.preferredInstructors.includes(instructorName);
    const updated = isPicked
      ? prefs.preferredInstructors.filter((n) => n !== instructorName)
      : [...prefs.preferredInstructors, instructorName];
    updatePrefs({ preferredInstructors: updated });
  }

  function generate(offset = 0) {
    if (selected.length < 2) {
      setMessage(t.autoSchedule.selectAtLeastTwo);
      return;
    }
    setBusy(true);
    setMessage("");

    window.setTimeout(() => {
      const result = generateSchedules(data, selected, prefs, offset);
      setResults((old) => (offset ? [...old, ...result.schedules] : result.schedules));
      setTruncated(result.truncated);
      setHasMore(result.hasMore);

      if (result.warnings.length) {
        setMessage(result.warnings.join(" "));
      } else if (!result.schedules.length) {
        setMessage(t.autoSchedule.noResultsTitle + ". " + t.autoSchedule.noResultsDesc);
      }
      setBusy(false);
    }, 40);
  }

  function handleSavePlan(schedule: GeneratedSchedule, index: number) {
    const defaultName = ar
      ? `جدول مقترح ${plansCreatedCount + 1} 😎`
      : `Generated Plan ${plansCreatedCount + 1} 😎`;
    const userChosenName = customPlanNames[index]?.trim() || defaultName;

    const now = new Date().toISOString();
    const newPlan: SchedulePlan = {
      id: crypto.randomUUID(),
      name: userChosenName.slice(0, 120),
      termId: data.term.id,
      sectionIds: [...schedule.sectionIds],
      createdAt: now,
      updatedAt: now,
    };

    onSave(newPlan);

    const scheduleKey = schedule.sectionIds.slice().sort().join("-");
    setSavedPlanKeys((prev) => new Set([...prev, scheduleKey]));
    setPlansCreatedCount((c) => c + 1);

    setToastMessage(t.autoSchedule.planSavedToast);
    setTimeout(() => setToastMessage(null), 3500);
  }

  function toggleExpandDetails(index: number) {
    setExpandedDetails((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <section
      className="planner-panel auto-schedule-panel"
      aria-labelledby="auto-schedule-title"
      dir={ar ? "rtl" : "ltr"}
    >
      {/* SECTION HEADER & BANNER */}
      <header className="auto-schedule-header">
        <div className="auto-schedule-title-wrap">
          <div className="auto-schedule-eyebrow">
            <span className="auto-schedule-badge">
              <AutoIcon name="spark" />
              <span>{t.autoSchedule.badge}</span>
            </span>
            <span className="auto-schedule-source-pill">
              {ar ? data.term.labelAr : data.term.labelEn ?? data.term.labelAr} ·{" "}
              {ar ? data.studentCategory?.labelAr : data.studentCategory?.labelEn ?? data.studentCategory?.labelAr ?? ""}
            </span>
          </div>

          <h2 id="auto-schedule-title" className="auto-schedule-main-title">
            {t.autoSchedule.title}
          </h2>
          <p className="auto-schedule-subtitle">{t.autoSchedule.subtitle}</p>
        </div>

        <div className="auto-schedule-disclaimer-card">
          <span className="live-dot" />
          <span>{t.autoSchedule.snapshotDisclaimer}</span>
        </div>
      </header>

      {/* THREE-STEP GENERATOR WORKSPACE */}
      <div className="auto-schedule-flow">
        {/* STEP 1: SELECT COURSES */}
        <div className="auto-schedule-card auto-schedule-step-card">
          <div className="auto-schedule-step-heading">
            <div className="auto-schedule-step-num">1</div>
            <div>
              <h3 className="auto-schedule-step-title">{t.autoSchedule.step1Title}</h3>
              <p className="auto-schedule-step-hint">{t.autoSchedule.step1Subtitle}</p>
            </div>
            <div className="auto-schedule-step-count-badge">
              {t.autoSchedule.selectedCoursesCount(selected.length)}
            </div>
          </div>

          {/* Search bar & Department Picker */}
          <div className="auto-schedule-search-area">
            <div className="auto-schedule-filter-controls-row">
              <div className="auto-schedule-search-field">
                <label htmlFor={searchInputId} className="auto-schedule-search-label">
                  <AutoIcon name="search" />
                  <span>{t.autoSchedule.coursesLabel}</span>
                </label>
                <div className="auto-schedule-search-box">
                  <input
                    id={searchInputId}
                    type="text"
                    className="auto-schedule-search-input"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder={t.autoSchedule.courseSearchPlaceholder}
                    aria-label={t.autoSchedule.coursesLabel}
                  />
                  {courseSearch && (
                    <button
                      type="button"
                      className="auto-schedule-clear-search-btn"
                      onClick={() => setCourseSearch("")}
                      aria-label="Clear course search"
                      title="Clear search"
                    >
                      <AutoIcon name="x" />
                    </button>
                  )}
                </div>
              </div>

              <div className="auto-schedule-dept-field">
                <label htmlFor="auto-schedule-dept-select" className="auto-schedule-search-label">
                  <AutoIcon name="sliders" />
                  <span>{t.autoSchedule.departmentLabel}</span>
                </label>
                <select
                  id="auto-schedule-dept-select"
                  className="auto-schedule-dept-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  aria-label={t.autoSchedule.departmentLabel}
                >
                  <option value="all">
                    {t.autoSchedule.allDepartments} ({courses.length})
                  </option>
                  {departmentOptions.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.label} ({dept.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Accurate Total/Filtered Counts & Reset filter action */}
            <div className="auto-schedule-courses-meta-bar">
              <span className="auto-schedule-courses-count-text">
                {t.autoSchedule.showingCoursesCount(filteredCourses.length, courses.length)}
              </span>
              {(deptFilter !== "all" || courseSearch) && (
                <button
                  type="button"
                  className="auto-schedule-reset-filters-btn"
                  onClick={() => {
                    setCourseSearch("");
                    setDeptFilter("all");
                  }}
                >
                  {t.autoSchedule.clearFilters} ↺
                </button>
              )}
            </div>
          </div>

          {/* Course chips / selection grid */}
          <div className="auto-schedule-courses-container">
            <div className="auto-schedule-courses-scroll" role="group" aria-label={t.autoSchedule.availableCourses}>
              {filteredCourses.map((c) => {
                const isSelected = selected.includes(c.id);
                const loc = getLocalizedCourseTitle(c, lang);
                const secCount = sectionCountsByCourse.get(c.id) ?? 0;
                const elig = courseEligibility.get(c.id);

                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`auto-schedule-course-pill ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleCourse(c.id)}
                    aria-pressed={isSelected}
                    title={`${c.code} · ${loc.title}`}
                  >
                    <span className="course-pill-code">
                      <bdi dir="ltr">{c.code}</bdi>
                    </span>
                    <span className="course-pill-title">
                      <bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>
                        {loc.title}
                      </bdi>
                    </span>
                    <div className="course-pill-badges">
                      {elig?.statusReason === "no-times" ? (
                        <span className="eligibility-tag no-times" title={t.autoSchedule.eligibilityNoTimes}>
                          ⚠️ {t.autoSchedule.eligibilityNoTimes}
                        </span>
                      ) : elig?.statusReason === "snapshot-closed" ? (
                        <span className="eligibility-tag snapshot-closed" title={t.autoSchedule.eligibilityClosed}>
                          🔒 {t.autoSchedule.eligibilityClosed}
                        </span>
                      ) : elig?.statusReason === "no-sections" ? (
                        <span className="eligibility-tag no-sections" title={t.autoSchedule.eligibilityNoSections}>
                          ⚠️ {t.autoSchedule.eligibilityNoSections}
                        </span>
                      ) : (
                        <span className="eligibility-tag eligible" title={t.autoSchedule.eligibilityEligible}>
                          ✓ {secCount} {ar ? "شعب" : "sec"}
                        </span>
                      )}
                    </div>
                    <span className="course-pill-check">
                      <AutoIcon name={isSelected ? "check" : "plus"} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected courses tray */}
          <div className="auto-schedule-selected-tray">
            <div className="auto-schedule-tray-header">
              <span className="auto-schedule-tray-title">
                {t.autoSchedule.selectedCoursesCount(selected.length)}
              </span>
              {selected.length > 0 && (
                <button
                  type="button"
                  className="auto-schedule-tray-clear-btn"
                  onClick={clearAllCourses}
                >
                  <AutoIcon name="trash" />
                  <span>{t.autoSchedule.clearSelectedCourses}</span>
                </button>
              )}
            </div>

            {selected.length === 0 ? (
              <p className="auto-schedule-empty-tray">{t.autoSchedule.noCoursesSelected}</p>
            ) : (
              <div className="auto-schedule-selected-chips">
                {selected.map((courseId) => {
                  const course = courseMap.get(courseId);
                  if (!course) return null;
                  const loc = getLocalizedCourseTitle(course, lang);
                  const cleanCode = course.code.includes("-") ? course.code.split("-")[1] : course.code;

                  return (
                    <span className="auto-schedule-chip" key={course.id}>
                      <span className="chip-code">
                        <bdi dir="ltr">{cleanCode}</bdi>
                      </span>
                      <span className="chip-title">
                        <bdi dir={loc.isRtl ? "rtl" : "ltr"} lang={loc.isRtl ? "ar" : "en"}>
                          {loc.title}
                        </bdi>
                      </span>
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => removeCourse(course.id)}
                        aria-label={`Remove ${cleanCode}`}
                        title="Remove course"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* STEP 2: CUSTOMIZE YOUR SCHEDULE */}
        <div className="auto-schedule-card auto-schedule-step-card">
          <div className="auto-schedule-step-heading">
            <div className="auto-schedule-step-num">2</div>
            <div>
              <h3 className="auto-schedule-step-title">{t.autoSchedule.step2Title}</h3>
              <p className="auto-schedule-step-hint">{t.autoSchedule.step2Subtitle}</p>
            </div>
            <button
              type="button"
              className="auto-schedule-reset-btn"
              onClick={resetPreferences}
              title={t.autoSchedule.resetPreferences}
            >
              <span>{t.autoSchedule.resetPreferences}</span>
            </button>
          </div>

          <div className="auto-schedule-preferences-grid">
            {/* HARD REQUIREMENTS COLUMN */}
            <div className="preference-group hard-group">
              <div className="preference-group-header">
                <AutoIcon name="shield" />
                <div>
                  <h4>{t.autoSchedule.hardConstraintsTitle}</h4>
                  <p>{t.autoSchedule.hardConstraintsDesc}</p>
                </div>
              </div>

              {/* Days Off Chips */}
              <div className="preference-control">
                <span className="control-label">{t.autoSchedule.daysOffLabel}</span>
                <div className="days-off-chips-row" role="group" aria-label={t.autoSchedule.daysOffLabel}>
                  {ALL_DAYS.map((d) => {
                    const isOff = prefs.hardDaysOff.includes(d);
                    const labelInfo = dayLabels[d];
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`day-chip ${isOff ? "is-off" : ""}`}
                        onClick={() => toggleDayOff(d)}
                        aria-pressed={isOff}
                        aria-label={`${labelInfo.aria} ${isOff ? (ar ? "(إجازة)" : "(Off)") : ""}`}
                        title={labelInfo.aria}
                      >
                        <span className="day-chip-label">{labelInfo.chip}</span>
                        {isOff && <span className="day-off-indicator">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Earliest Start (Hard) */}
              <div className="preference-control">
                <label htmlFor="hard-earliest-select" className="control-label">
                  {t.autoSchedule.earliestStartLabel}
                </label>
                <select
                  id="hard-earliest-select"
                  className="preference-select"
                  value={prefs.hardEarliestMinutes ?? ""}
                  onChange={(e) =>
                    updatePrefs({ hardEarliestMinutes: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  {EARLIEST_START_CHOICES.map((choice) => (
                    <option key={choice.value ?? "none"} value={choice.value ?? ""}>
                      {ar ? choice.labelAr : choice.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Latest End (Hard) */}
              <div className="preference-control">
                <label htmlFor="hard-latest-select" className="control-label">
                  {t.autoSchedule.latestEndLabel}
                </label>
                <select
                  id="hard-latest-select"
                  className="preference-select"
                  value={prefs.hardLatestMinutes ?? ""}
                  onChange={(e) =>
                    updatePrefs({ hardLatestMinutes: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  {LATEST_END_CHOICES.map((choice) => (
                    <option key={choice.value ?? "none"} value={choice.value ?? ""}>
                      {ar ? choice.labelAr : choice.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exclude Snapshot-closed sections */}
              <div className="preference-control">
                <label className="toggle-label-card">
                  <input
                    type="checkbox"
                    className="preference-checkbox"
                    checked={prefs.openOnly}
                    onChange={(e) => updatePrefs({ openOnly: e.target.checked })}
                  />
                  <div className="toggle-card-text">
                    <span className="toggle-main-title">{t.autoSchedule.excludeClosedLabel}</span>
                    <span className="toggle-sub-desc">{t.autoSchedule.excludeClosedDesc}</span>
                  </div>
                </label>
              </div>
            </div>

            {/* SOFT PREFERENCES COLUMN */}
            <div className="preference-group soft-group">
              <div className="preference-group-header">
                <AutoIcon name="sliders" />
                <div>
                  <h4>{t.autoSchedule.softPreferencesTitle}</h4>
                  <p>{t.autoSchedule.softPreferencesDesc}</p>
                </div>
              </div>

              {/* Preferred Start Time */}
              <div className="preference-control">
                <label htmlFor="preferred-start-select" className="control-label">
                  {t.autoSchedule.preferredStartLabel}
                </label>
                <select
                  id="preferred-start-select"
                  className="preference-select"
                  value={prefs.preferredEarliestMinutes ?? ""}
                  onChange={(e) =>
                    updatePrefs({
                      preferredEarliestMinutes: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                >
                  {PREFERRED_START_CHOICES.map((choice) => (
                    <option key={choice.value ?? "none"} value={choice.value ?? ""}>
                      {ar ? choice.labelAr : choice.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fewer Campus Days */}
              <div className="preference-control">
                <label className="toggle-label-card">
                  <input
                    type="checkbox"
                    className="preference-checkbox"
                    checked={prefs.fewerDays}
                    onChange={(e) => updatePrefs({ fewerDays: e.target.checked })}
                  />
                  <div className="toggle-card-text">
                    <span className="toggle-main-title">{t.autoSchedule.fewerDaysLabel}</span>
                    <span className="toggle-sub-desc">{t.autoSchedule.fewerDaysDesc}</span>
                  </div>
                </label>
              </div>

              {/* Shorter Gaps */}
              <div className="preference-control">
                <label className="toggle-label-card">
                  <input
                    type="checkbox"
                    className="preference-checkbox"
                    checked={prefs.shorterGaps}
                    onChange={(e) => updatePrefs({ shorterGaps: e.target.checked })}
                  />
                  <div className="toggle-card-text">
                    <span className="toggle-main-title">{t.autoSchedule.shorterGapsLabel}</span>
                    <span className="toggle-sub-desc">{t.autoSchedule.shorterGapsDesc}</span>
                  </div>
                </label>
              </div>

              {/* Preferred Instructors */}
              {availableInstructors.length > 0 && (
                <div className="preference-control">
                  <span className="control-label">{t.autoSchedule.preferredInstructorsLabel}</span>
                  <div className="instructors-chip-row">
                    {availableInstructors.slice(0, 10).map((instructorName) => {
                      const isPicked = prefs.preferredInstructors.includes(instructorName);
                      return (
                        <button
                          key={instructorName}
                          type="button"
                          className={`instructor-chip ${isPicked ? "is-picked" : ""}`}
                          onClick={() => toggleInstructor(instructorName)}
                          aria-pressed={isPicked}
                        >
                          <span>{instructorName}</span>
                          {isPicked && <AutoIcon name="check" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Result Count Segmented Control */}
              <div className="preference-control">
                <span className="control-label">{t.autoSchedule.resultsCountLabel}</span>
                <div className="results-count-segmented" role="radiogroup" aria-label={t.autoSchedule.resultsCountLabel}>
                  {([3, 5, 10, 20] as const).map((num) => (
                    <button
                      key={num}
                      type="button"
                      role="radio"
                      aria-checked={prefs.resultCount === num}
                      className={`segmented-opt ${prefs.resultCount === num ? "active" : ""}`}
                      onClick={() => updatePrefs({ resultCount: num })}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 3: GENERATE & COMPARE */}
        <div className="auto-schedule-card auto-schedule-step-card">
          <div className="auto-schedule-step-heading">
            <div className="auto-schedule-step-num">3</div>
            <div>
              <h3 className="auto-schedule-step-title">{t.autoSchedule.step3Title}</h3>
              <p className="auto-schedule-step-hint">{t.autoSchedule.step3Subtitle}</p>
            </div>
          </div>

          {/* Action Trigger Bar */}
          <div className="auto-schedule-action-bar">
            <button
              type="button"
              className="auto-schedule-primary-btn"
              onClick={() => generate(0)}
              disabled={busy}
              aria-busy={busy}
              aria-label={ar ? "أنشئ جدولًا" : "Generate schedules"}
            >
              <AutoIcon name="spark" />
              <span>{busy ? t.autoSchedule.generatingButton : t.autoSchedule.generateButton}</span>
            </button>
            {selected.length < 2 && (
              <span className="auto-schedule-action-hint">
                {ar ? "اختر مقررين أو أكثر للبدء" : "Pick 2 or more courses to enable"}
              </span>
            )}
          </div>

          {/* Messages & Alerts */}
          {message && (
            <div className="auto-schedule-alert-banner" role="status">
              <AutoIcon name="shield" />
              <span>{message}</span>
            </div>
          )}

          {truncated && (
            <div className="auto-schedule-truncated-banner" role="status">
              <span>{t.autoSchedule.safeLimitReached}</span>
            </div>
          )}

          {toastMessage && (
            <div className="auto-schedule-toast" role="alert">
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Empty Results Placeholder */}
          {results.length === 0 && !busy && !message && (
            <div className="auto-schedule-empty-state">
              <div className="auto-schedule-empty-icon">
                <AutoIcon name="calendar" />
              </div>
              <h4>{t.autoSchedule.emptyStateTitle}</h4>
              <p>{t.autoSchedule.emptyStateDesc}</p>
            </div>
          )}

          {/* Generated Results List */}
          {results.length > 0 && (
            <div className="auto-schedule-results-area">
              <div className="auto-schedule-results-meta">
                <span className="results-count-title">
                  {t.autoSchedule.resultsFound(results.length)}
                </span>
              </div>

              <div className="auto-schedule-results-grid">
                {results.map((result, idx) => {
                  const scheduleSections = result.sectionIds
                    .map((id) => sectionMap.get(id))
                    .filter(Boolean) as Section[];
                  const scheduleKey = result.sectionIds.slice().sort().join("-");
                  const isSaved = savedPlanKeys.has(scheduleKey);
                  const isDetailsOpen = !!expandedDetails[idx];

                  // Compute timespan and days count
                  const allMeetings = scheduleSections.flatMap((s) => s.meetings);
                  const campusDays = new Set(allMeetings.flatMap((m) => m.days));
                  const earliestMin = allMeetings.length
                    ? Math.min(...allMeetings.map((m) => m.startMinutes))
                    : 480;
                  const latestMin = allMeetings.length
                    ? Math.max(...allMeetings.map((m) => m.endMinutes))
                    : 960;

                  return (
                    <article
                      key={`${scheduleKey}-${idx}`}
                      className="auto-schedule-result-card"
                      aria-label={`${t.autoSchedule.optionRank(idx + 1)}`}
                    >
                      {/* CARD HEADER */}
                      <div className="result-card-header">
                        <div className="result-card-title-group">
                          <span className={`result-rank-badge ${idx === 0 ? "top-rank" : ""}`}>
                            {idx === 0 ? "★ " : ""}
                            {t.autoSchedule.optionRank(idx + 1)}
                          </span>
                          <div className="result-metrics-row">
                            <span className="result-metric-pill">
                              <AutoIcon name="calendar" />
                              <span>{t.autoSchedule.campusDays(campusDays.size)}</span>
                            </span>
                            <span className="result-metric-pill">
                              <AutoIcon name="clock" />
                              <span>
                                <bdi dir="ltr">
                                  {formatTime(earliestMin)} – {formatTime(latestMin)}
                                </bdi>
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Reasons Pills */}
                        {result.reasons.length > 0 && (
                          <div className="result-reasons-wrap">
                            {result.reasons.map((reason, rIdx) => (
                              <span className="result-reason-tag" key={rIdx}>
                                ✓ {localizeScheduleReason(reason, lang)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* MINI TIMETABLE PREVIEW */}
                      <div className="result-timetable-section">
                        <div className="result-timetable-label">
                          <AutoIcon name="calendar" />
                          <span>{t.autoSchedule.timetablePreview}</span>
                        </div>
                        <MiniTimetablePreview
                          scheduleSections={scheduleSections}
                          courseMap={courseMap}
                          lang={lang}
                          dayLabels={dayLabels}
                        />
                      </div>

                      {/* TOGGLE SECTION DETAILS */}
                      <div className="result-sections-toggle-row">
                        <button
                          type="button"
                          className="result-details-toggle-btn"
                          onClick={() => toggleExpandDetails(idx)}
                          aria-expanded={isDetailsOpen}
                        >
                          <span>{isDetailsOpen ? t.autoSchedule.hideSections : t.autoSchedule.viewSections}</span>
                          <AutoIcon name={isDetailsOpen ? "chevronUp" : "chevronDown"} />
                        </button>
                      </div>

                      {/* EXPANDABLE SECTIONS LIST */}
                      {isDetailsOpen && (
                        <div className="result-sections-list">
                          {scheduleSections.map((sec) => {
                            const crs = courseMap.get(sec.courseId);
                            const loc = crs ? getLocalizedCourseTitle(crs, lang) : null;
                            const isOpen = sec.status === "open";

                            return (
                              <div className="result-section-row" key={sec.id}>
                                <div className="result-sec-info">
                                  <span className="result-sec-code">
                                    <bdi dir="ltr">{crs?.code}</bdi>
                                  </span>
                                  <span className="result-sec-title">
                                    <bdi dir={loc?.isRtl ? "rtl" : "ltr"} lang={loc?.isRtl ? "ar" : "en"}>
                                      {loc?.title}
                                    </bdi>
                                  </span>
                                  <span className="result-sec-crn">
                                    {t.autoSchedule.crnLabel}: <bdi dir="ltr">{sec.crn}</bdi>
                                  </span>
                                </div>

                                <div className="result-sec-meetings">
                                  {sec.meetings.map((m, mIdx) => (
                                    <span className="result-sec-meeting-item" key={mIdx}>
                                      <bdi dir="ltr">{m.days.map((d) => dayLabels[d].chip).join(", ")}</bdi>{" "}
                                      <bdi dir="ltr">{formatTime(m.startMinutes)}–{formatTime(m.endMinutes)}</bdi>
                                    </span>
                                  ))}
                                  {sec.instructor?.name && (
                                    <span className="result-sec-instructor">
                                      👤 {sec.instructor.name}
                                    </span>
                                  )}
                                </div>

                                <div className="result-sec-status">
                                  <span className={`status-pill ${isOpen ? "status-open" : "status-closed"}`}>
                                    {isOpen
                                      ? ar
                                        ? "متاحة في آخر تحديث"
                                        : "Available in latest update"
                                      : ar
                                      ? "غير متاحة في آخر تحديث"
                                      : "Unavailable in latest update"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* SAVE AS PLAN ROW */}
                      <div className="result-save-card-bar">
                        <div className="result-save-input-wrap">
                          <input
                            type="text"
                            className="result-plan-name-input"
                            value={customPlanNames[idx] ?? ""}
                            onChange={(e) =>
                              setCustomPlanNames((prev) => ({ ...prev, [idx]: e.target.value }))
                            }
                            placeholder={t.autoSchedule.planNamePlaceholder}
                            maxLength={100}
                            aria-label="Custom plan name"
                          />
                        </div>
                        <button
                          type="button"
                          className={`result-save-plan-btn ${isSaved ? "is-saved" : ""}`}
                          onClick={() => handleSavePlan(result, idx)}
                        >
                          <AutoIcon name={isSaved ? "check" : "save"} />
                          <span>{isSaved ? (ar ? "تم الحفظ كخطة جديدة ✓" : "Saved as New Plan ✓") : t.autoSchedule.saveAsPlan}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* GENERATE MORE BUTTON */}
              {hasMore && (
                <div className="auto-schedule-more-row">
                  <button
                    type="button"
                    className="auto-schedule-more-btn"
                    disabled={busy}
                    onClick={() => generate(results.length)}
                  >
                    <span>{t.autoSchedule.generateMoreButton}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const COLOR_PALETTE = [
  "mini-lime",
  "mini-mint",
  "mini-sky",
  "mini-sand",
  "mini-violet",
  "mini-coral",
];

// -------------------------------------------------------------
// Sleek, Responsive Mini Timetable Preview
// -------------------------------------------------------------
function MiniTimetablePreview({
  scheduleSections,
  courseMap,
  lang,
  dayLabels,
}: {
  scheduleSections: Section[];
  courseMap: Map<string, Course>;
  lang: Language;
  dayLabels: Record<Day, { chip: string; aria: string }>;
}) {
  const courseColorIndex = useMemo(() => {
    const map = new Map<string, string>();
    let idx = 0;
    for (const sec of scheduleSections) {
      if (!map.has(sec.courseId)) {
        map.set(sec.courseId, COLOR_PALETTE[idx % COLOR_PALETTE.length]);
        idx++;
      }
    }
    return map;
  }, [scheduleSections]);

  const meetings = useMemo(() => {
    const list: { meeting: SectionMeeting; section: Section; course: Course; colorClass: string }[] = [];
    for (const sec of scheduleSections) {
      const crs = courseMap.get(sec.courseId);
      if (!crs) continue;
      const colorClass = courseColorIndex.get(sec.courseId) ?? "mini-lime";
      for (const m of sec.meetings) {
        list.push({ meeting: m, section: sec, course: crs, colorClass });
      }
    }
    return list;
  }, [scheduleSections, courseMap, courseColorIndex]);

  // Normalize grid time bounds (from 07:00 to 19:00 = 720 minutes span)
  const minMinutes = 420; // 07:00
  const maxMinutes = 1140; // 19:00
  const totalDuration = maxMinutes - minMinutes;

  return (
    <div className="mini-timetable-container">
      <div className="mini-timetable-grid">
        {ALL_DAYS.map((day) => {
          const dayMeetings = meetings.filter((item) => item.meeting.days.includes(day));

          return (
            <div className="mini-timetable-col" key={day}>
              <div className="mini-col-header">
                <span>{dayLabels[day].chip}</span>
              </div>
              <div className="mini-col-track">
                {dayMeetings.map(({ meeting, section, course, colorClass }) => {
                  const top = Math.max(0, ((meeting.startMinutes - minMinutes) / totalDuration) * 100);
                  const height = Math.max(
                    ((meeting.endMinutes - meeting.startMinutes) / totalDuration) * 100,
                    16
                  );
                  const cleanCode = course.code.includes("-") ? course.code.split("-")[1] : course.code;
                  const loc = getLocalizedCourseTitle(course, lang);

                  return (
                    <div
                      key={`${section.id}-${meeting.id}-${day}`}
                      className={`mini-block ${colorClass}`}
                      style={{ top: `${top}%`, height: `${height}%` }}
                      title={`${cleanCode} · ${loc.title} (${formatTime(meeting.startMinutes)}–${formatTime(meeting.endMinutes)})`}
                    >
                      <span className="mini-block-code"><bdi dir="ltr">{cleanCode}</bdi></span>
                      <span className="mini-block-time">
                        <bdi dir="ltr">{formatTime(meeting.startMinutes)}</bdi>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
