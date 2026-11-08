import { describe, expect, it } from "vitest";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  extractFilterOptions,
  filterSections,
  type ExplorerFilters,
} from "./explorer-filters";
import type { Course, DataImport, Section } from "./schema";

const mockCourses: Course[] = [
  { id: "term1:0602-101", termId: "term1", departmentId: "0602", code: "0602-101", titleAr: "مبادئ إدارة", credits: 3 },
  { id: "term1:0603-201", termId: "term1", departmentId: "0603", code: "0603-201", titleAr: "مبادئ محاسبة", credits: 3 },
  { id: "term1:0603-202", termId: "term1", departmentId: "0603", code: "0603-202", titleAr: "محاسبة متوسطة", credits: 3 },
];

const mockSections: Section[] = [
  {
    id: "term1:1001",
    termId: "term1",
    courseId: "term1:0602-101",
    crn: "1001",
    sectionCode: "01",
    status: "open",
    instructionalFormat: "نظري",
    instructor: { id: "dr-ahmed", name: "د. أحمد علي" },
    meetings: [
      { id: "m1", days: ["sun", "tue", "thu"], startMinutes: 480, endMinutes: 530, activity: "نظري" },
    ],
    linkedSectionIds: [],
    provenance: { sourceUrl: "https://kfu.edu.sa", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
  },
  {
    id: "term1:1002",
    termId: "term1",
    courseId: "term1:0602-101",
    crn: "1002",
    sectionCode: "02",
    status: "closed",
    instructionalFormat: "نظري",
    instructor: { id: "dr-saleh", name: "د. صالح خالد" },
    meetings: [
      { id: "m2", days: ["mon", "wed"], startMinutes: 600, endMinutes: 675, activity: "نظري" },
    ],
    linkedSectionIds: [],
    provenance: { sourceUrl: "https://kfu.edu.sa", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
  },
  {
    id: "term1:2001",
    termId: "term1",
    courseId: "term1:0603-201",
    crn: "2001",
    sectionCode: "01",
    status: "open",
    instructionalFormat: "ا ختياري",
    instructor: { id: "dr-ahmed", name: "د. أحمد علي" },
    meetings: [
      { id: "m3a", days: ["sun"], startMinutes: 720, endMinutes: 810, activity: "نظري" },
      { id: "m3b", days: ["tue"], startMinutes: 720, endMinutes: 810, activity: "ا ختياري" },
    ],
    linkedSectionIds: [],
    provenance: { sourceUrl: "https://kfu.edu.sa", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
  },
];

describe("Advanced Course Explorer Filters (LEMON-011)", () => {
  it("filters by department cascading", () => {
    const filters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      departmentId: "0602",
    };

    const { visibleSections, visibleGroups } = filterSections(mockSections, mockCourses, filters);
    expect(visibleSections).toHaveLength(2);
    expect(visibleGroups).toHaveLength(1);
    expect(visibleGroups[0].course.code).toBe("0602-101");
  });

  it("filters by specific course", () => {
    const filters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      courseId: "term1:0603-201",
    };

    const { visibleSections } = filterSections(mockSections, mockCourses, filters);
    expect(visibleSections).toHaveLength(1);
    expect(visibleSections[0].crn).toBe("2001");
  });

  it("filters by availability status", () => {
    const openFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      status: "open",
    };
    const { visibleSections: openSections } = filterSections(mockSections, mockCourses, openFilters);
    expect(openSections.map((s) => s.crn)).toEqual(["1001", "2001"]);

    const closedFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      status: "closed",
    };
    const { visibleSections: closedSections } = filterSections(mockSections, mockCourses, closedFilters);
    expect(closedSections.map((s) => s.crn)).toEqual(["1002"]);
  });

  it("distinguishes matching meeting days from avoiding selected days", () => {
    // Mode "match": must meet on at least one selected day (e.g. Monday)
    const matchFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      selectedDays: ["mon"],
      dayMode: "match",
    };
    const { visibleSections: matchMon } = filterSections(mockSections, mockCourses, matchFilters);
    expect(matchMon.map((s) => s.crn)).toEqual(["1002"]);

    // Mode "avoid": must NOT meet on Monday (avoids Monday)
    const avoidFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      selectedDays: ["mon"],
      dayMode: "avoid",
    };
    const { visibleSections: avoidMon } = filterSections(mockSections, mockCourses, avoidFilters);
    expect(avoidMon.map((s) => s.crn)).toEqual(["1001", "2001"]);

    // Mode "avoid" Thursday (1001 meets Sun/Tue/Thu -> should be excluded)
    const avoidThuFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      selectedDays: ["thu"],
      dayMode: "avoid",
    };
    const { visibleSections: avoidThu } = filterSections(mockSections, mockCourses, avoidThuFilters);
    expect(avoidThu.map((s) => s.crn)).toEqual(["1002", "2001"]);
  });

  it("supports sections with multiple meeting blocks across different days and activities", () => {
    const multiBlockFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      selectedDays: ["tue"],
      dayMode: "match",
    };
    // CRN 1001 meets sun/tue/thu, CRN 2001 has block on tue
    const { visibleSections } = filterSections(mockSections, mockCourses, multiBlockFilters);
    expect(visibleSections.map((s) => s.crn)).toEqual(["1001", "2001"]);
  });

  it("filters by time range constraints", () => {
    // Earliest start time: 600 (10:00 AM) - CRN 1001 starts at 480 (8:00 AM) -> excluded
    const timeFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      startTimeMinutes: 600,
    };
    const { visibleSections } = filterSections(mockSections, mockCourses, timeFilters);
    expect(visibleSections.map((s) => s.crn)).toEqual(["1002", "2001"]);

    // Latest end time: 700 - CRN 2001 ends at 810 -> excluded
    const endFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      endTimeMinutes: 700,
    };
    const { visibleSections: endSections } = filterSections(mockSections, mockCourses, endFilters);
    expect(endSections.map((s) => s.crn)).toEqual(["1001", "1002"]);
  });

  it("filters by exact CRN", () => {
    const filters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      exactCrn: "1002",
    };
    const { visibleSections } = filterSections(mockSections, mockCourses, filters);
    expect(visibleSections).toHaveLength(1);
    expect(visibleSections[0].crn).toBe("1002");
  });

  it("filters by section activity / instructional format", () => {
    const filters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      activity: "ا ختياري",
    };
    const { visibleSections } = filterSections(mockSections, mockCourses, filters);
    expect(visibleSections).toHaveLength(1);
    expect(visibleSections[0].crn).toBe("2001");
  });

  it("normalizes Arabic text in general query search (LEMON-029)", () => {
    // mockCourses[0].titleAr is "مبادئ إدارة"
    // Query without hamza "ادارة" should match "إدارة"
    const filtersWithoutHamza: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      query: "ادارة",
    };
    const { visibleSections: match1 } = filterSections(mockSections, mockCourses, filtersWithoutHamza);
    expect(match1.map((s) => s.crn)).toEqual(["1001", "1002"]);

    // Query with diacritics / tashkeel "إِدَارَة"
    const filtersWithTashkeel: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      query: "إِدَارَة",
    };
    const { visibleSections: match2 } = filterSections(mockSections, mockCourses, filtersWithTashkeel);
    expect(match2.map((s) => s.crn)).toEqual(["1001", "1002"]);

    // Query "مبادىء" should match "مبادئ"
    const filtersWithMaksura: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      query: "مبادىء",
    };
    const { visibleSections: match3 } = filterSections(mockSections, mockCourses, filtersWithMaksura);
    expect(match3.length).toBeGreaterThan(0);
  });

  it("extracts unique filter options from data import", () => {
    const data: DataImport = {
      id: "test",
      term: { id: "term1", labelAr: "الفصل الأول" },
      college: { id: "col1", nameAr: "كلية العلوم" },
      studentCategory: { id: "11", labelAr: "طلاب" },
      importedAt: "2026-01-01T00:00:00Z",
      sourceUrl: "https://kfu.edu.sa",
      sourceLabel: "KFU",
      status: "verified-snapshot",
      courses: mockCourses,
      sections: mockSections,
      warnings: [],
    };

    const options = extractFilterOptions(data);
    expect(options.departments).toEqual([
      { id: "0602", name: "Dept 0602", courseCount: 1 },
      { id: "0603", name: "Dept 0603", courseCount: 2 },
    ]);
    expect(options.instructors).toContain("د. أحمد علي");
    expect(options.instructors).toContain("د. صالح خالد");
    expect(options.activities).toContain("نظري");
    expect(options.activities).toContain("ا ختياري");
  });

  it("counts active filters correctly", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);

    const activeFilters: ExplorerFilters = {
      ...DEFAULT_FILTERS,
      departmentId: "0602",
      selectedDays: ["sun"],
      status: "open",
    };
    expect(countActiveFilters(activeFilters)).toBe(3);
  });
});
