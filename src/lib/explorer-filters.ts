import { type Course, type DataImport, type Day, type Section } from "./schema";
import { matchesSearchText } from "./search-normalizer";
import { getLocalizedCourseTitle } from "./i18n/course-titles";

export type DayMatchMode = "match" | "avoid";

export type ExplorerFilters = {
  termId: string;
  categoryCode: string;
  departmentId: string;
  courseId: string;
  activity: string;
  status: "all" | "open" | "closed";
  instructor: string;
  selectedDays: Day[];
  dayMode: DayMatchMode;
  startTimeMinutes: number | null;
  endTimeMinutes: number | null;
  query: string;
  exactCrn: string;
};

export const DEFAULT_FILTERS: ExplorerFilters = {
  termId: "",
  categoryCode: "",
  departmentId: "all",
  courseId: "all",
  activity: "all",
  status: "all",
  instructor: "all",
  selectedDays: [],
  dayMode: "match",
  startTimeMinutes: null,
  endTimeMinutes: null,
  query: "",
  exactCrn: "",
};

export const VERIFIED_DEPARTMENT_NAMES: Record<string, { en: string; ar: string }> = {
  "0602": { en: "Management", ar: "الإدارة" },
  "0603": { en: "Accounting", ar: "المحاسبة" },
  "0604": { en: "Finance", ar: "المالية" },
  "0605": { en: "Economics", ar: "الاقتصاد" },
  "0606": { en: "Quantitative Methods", ar: "الأساليب الكمية" },
  "0607": { en: "Management Info Systems", ar: "نظم المعلومات الإدارية" },
  "0608": { en: "Law", ar: "القانون" },
  "0612": { en: "Accounting", ar: "المحاسبة" },
  "0622": { en: "Business Administration", ar: "إدارة الأعمال" },
  "0642": { en: "Practical Training", ar: "التدريب العملي" },
  "0673": { en: "Management (Applied)", ar: "الإدارة (تطبيقي)" },
  "0674": { en: "Accounting (Applied)", ar: "المحاسبة (تطبيقي)" },
  "0675": { en: "Finance (Applied)", ar: "المالية (تطبيقي)" },
  "0676": { en: "Quantitative Methods (Applied)", ar: "الأساليب الكمية (تطبيقي)" },
  "0677": { en: "Info Systems (Applied)", ar: "نظم المعلومات (تطبيقي)" },
  "0678": { en: "Economics (Applied)", ar: "الاقتصاد (تطبيقي)" },
};

export function getDepartmentLabel(id: string, lang: "en" | "ar" = "en"): string {
  const verified = VERIFIED_DEPARTMENT_NAMES[id];
  if (!verified) return `Dept ${id}`;
  return lang === "ar" ? `${id} · ${verified.ar}` : `${id} · ${verified.en}`;
}

export type FilterOptions = {
  departments: { id: string; name: string; courseCount: number }[];
  instructors: string[];
  activities: string[];
};

export function extractFilterOptions(data: DataImport): FilterOptions {
  const deptCourseCount = new Map<string, number>();
  for (const course of data.courses) {
    const deptId = course.departmentId ?? course.code.split("-")[0] ?? "other";
    deptCourseCount.set(deptId, (deptCourseCount.get(deptId) ?? 0) + 1);
  }

  const departments = [...deptCourseCount.entries()]
    .map(([id, courseCount]) => ({
      id,
      name: `Dept ${id}`,
      courseCount,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const instructorSet = new Set<string>();
  const activitySet = new Set<string>();

  for (const section of data.sections) {
    if (section.instructor?.name?.trim()) {
      instructorSet.add(section.instructor.name.trim());
    }
    if (section.instructionalFormat?.trim()) {
      activitySet.add(section.instructionalFormat.trim());
    }
    for (const meeting of section.meetings) {
      if (meeting.activity?.trim()) {
        activitySet.add(meeting.activity.trim());
      }
    }
  }

  return {
    departments,
    instructors: [...instructorSet].sort((a, b) => a.localeCompare(b, "ar")),
    activities: [...activitySet].sort((a, b) => a.localeCompare(b, "ar")),
  };
}

export function countActiveFilters(filters: ExplorerFilters): number {
  let count = 0;
  if (filters.departmentId !== "all") count++;
  if (filters.courseId !== "all") count++;
  if (filters.activity !== "all") count++;
  if (filters.status !== "all") count++;
  if (filters.instructor !== "all") count++;
  if (filters.selectedDays.length > 0) count++;
  if (filters.startTimeMinutes !== null) count++;
  if (filters.endTimeMinutes !== null) count++;
  if (filters.exactCrn.trim() !== "") count++;
  if (filters.query.trim() !== "") count++;
  return count;
}

export function filterSections(
  sections: Section[],
  courses: Course[],
  filters: ExplorerFilters,
): { visibleSections: Section[]; visibleGroups: { course: Course; sections: Section[] }[] } {
  const courseMap = new Map(courses.map((course) => [course.id, course]));
  const trimmedCrn = filters.exactCrn.trim();

  const visibleSections = sections.filter((section) => {
    // 1. Term check
    if (filters.termId && section.termId !== filters.termId) {
      return false;
    }

    // 2. Exact CRN filter
    if (trimmedCrn && section.crn !== trimmedCrn) {
      return false;
    }

    // 3. Status availability
    if (filters.status !== "all" && section.status !== filters.status) {
      return false;
    }

    // 4. Department and Course
    const course = courseMap.get(section.courseId);
    if (!course) return false;

    const deptId = course.departmentId ?? course.code.split("-")[0];
    if (filters.departmentId !== "all" && deptId !== filters.departmentId) {
      return false;
    }

    if (filters.courseId !== "all" && course.id !== filters.courseId) {
      return false;
    }

    // 5. Activity / Section format
    if (filters.activity !== "all") {
      const matchFormat = section.instructionalFormat === filters.activity;
      const matchMeeting = section.meetings.some((m) => m.activity === filters.activity);
      if (!matchFormat && !matchMeeting) return false;
    }

    // 6. Instructor
    if (filters.instructor !== "all" && section.instructor?.name !== filters.instructor) {
      return false;
    }

    // 7. Days filter (distinguish match vs avoid)
    if (filters.selectedDays.length > 0) {
      const sectionDays = new Set(section.meetings.flatMap((m) => m.days));
      const hasAnySelectedDay = filters.selectedDays.some((d) => sectionDays.has(d));

      if (filters.dayMode === "match") {
        // Must meet on at least one of the selected days
        if (!hasAnySelectedDay) return false;
      } else {
        // "avoid": Must NOT meet on ANY of the selected days
        if (hasAnySelectedDay) return false;
      }
    }

    // 8. Time range filter
    if (filters.startTimeMinutes !== null && section.meetings.length > 0) {
      // Must not start before the minimum requested start time
      if (section.meetings.some((m) => m.startMinutes < filters.startTimeMinutes!)) {
        return false;
      }
    }

    if (filters.endTimeMinutes !== null && section.meetings.length > 0) {
      // Must not end after the maximum requested end time
      if (section.meetings.some((m) => m.endMinutes > filters.endTimeMinutes!)) {
        return false;
      }
    }

    // 9. General search query (Arabic and English aware normalization)
    if (filters.query.trim()) {
      const enTitle = getLocalizedCourseTitle(course, "en").title;
      const haystack = `${course.code} ${course.titleAr} ${enTitle} ${course.titleEn ?? ""} ${section.crn} ${section.instructor?.name ?? ""}`;
      if (!matchesSearchText(haystack, filters.query)) {
        return false;
      }
    }

    return true;
  });

  // Group by course
  const groups = new Map<string, Section[]>();
  for (const section of visibleSections) {
    const list = groups.get(section.courseId);
    if (list) list.push(section);
    else groups.set(section.courseId, [section]);
  }

  const visibleGroups = [...groups.entries()]
    .map(([courseId, groupSections]) => ({
      course: courseMap.get(courseId)!,
      sections: groupSections,
    }))
    .filter((g) => Boolean(g.course));

  return { visibleSections, visibleGroups };
}
