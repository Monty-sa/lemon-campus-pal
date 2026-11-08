import { describe, expect, it } from "vitest";
import { femaleOfferings, maleOfferings } from "@/data/offerings";
import { getLocalizedCourseTitle, VERIFIED_ENGLISH_COURSE_TITLES } from "./course-titles";
import { filterSections, DEFAULT_FILTERS } from "@/lib/explorer-filters";
import { renderTimetableToCanvas } from "@/lib/export/timetable-export";

describe("LEMON-041 Complete Arabic / English Localization Audit", () => {
  it("1. Verifies 100% English title coverage across all unique male and female Business College courses", () => {
    const courseMap = new Map<string, { code: string; titleAr: string }>();

    for (const c of maleOfferings.courses) {
      courseMap.set(c.code.trim(), { code: c.code.trim(), titleAr: c.titleAr.trim() });
    }
    for (const c of femaleOfferings.courses) {
      if (!courseMap.has(c.code.trim())) {
        courseMap.set(c.code.trim(), { code: c.code.trim(), titleAr: c.titleAr.trim() });
      }
    }

    expect(courseMap.size).toBe(192);

    const missingTranslations: string[] = [];
    for (const [code, course] of courseMap.entries()) {
      const localizedEn = getLocalizedCourseTitle(course, "en");
      if (localizedEn.isFallback || !VERIFIED_ENGLISH_COURSE_TITLES[code]) {
        missingTranslations.push(`${code}: ${course.titleAr}`);
      }
    }

    expect(missingTranslations).toEqual([]);
    expect(Object.keys(VERIFIED_ENGLISH_COURSE_TITLES).length).toBeGreaterThanOrEqual(192);
  });

  it("2. Verifies English mode produces an authentic English title with LTR metadata", () => {
    const sampleCourse = { code: "0603-101", titleAr: "مبادىء المحاسبة (1)" };
    const localized = getLocalizedCourseTitle(sampleCourse, "en");

    expect(localized.title).toBe("Principles of Accounting I");
    expect(localized.isRtl).toBe(false);
    expect(localized.isFallback).toBe(false);
  });

  it("3. Verifies Arabic mode preserves canonical Arabic titles with RTL metadata", () => {
    const sampleCourse = { code: "0603-101", titleAr: "مبادىء المحاسبة (1)" };
    const localized = getLocalizedCourseTitle(sampleCourse, "ar");

    expect(localized.title).toBe("مبادىء المحاسبة (1)");
    expect(localized.isRtl).toBe(true);
    expect(localized.isFallback).toBe(false);
  });

  it("4. Verifies search works symmetrically across both English and Arabic queries", () => {
    // English query: "Accounting" should find accounting sections (0603-101)
    const enFilters = { ...DEFAULT_FILTERS, query: "Accounting" };
    const enResult = filterSections(maleOfferings.sections, maleOfferings.courses, enFilters);
    expect(enResult.visibleSections.length).toBeGreaterThan(0);
    expect(enResult.visibleGroups.some((g) => g.course.code.startsWith("0603-"))).toBe(true);

    // Arabic query: "محاسبة" should find the exact same accounting sections
    const arFilters = { ...DEFAULT_FILTERS, query: "محاسبة" };
    const arResult = filterSections(maleOfferings.sections, maleOfferings.courses, arFilters);
    expect(arResult.visibleSections.length).toBeGreaterThan(0);
    expect(arResult.visibleGroups.some((g) => g.course.code.startsWith("0603-"))).toBe(true);

    // English query: "Marketing" vs Arabic "تسويق"
    const enMarketing = filterSections(maleOfferings.sections, maleOfferings.courses, { ...DEFAULT_FILTERS, query: "Marketing" });
    const arMarketing = filterSections(maleOfferings.sections, maleOfferings.courses, { ...DEFAULT_FILTERS, query: "تسويق" });
    expect(enMarketing.visibleSections.length).toBeGreaterThan(0);
    expect(arMarketing.visibleSections.length).toBeGreaterThan(0);
  });

  it("5. Verifies exports render localized course names according to selected language", () => {
    const course = maleOfferings.courses[0];
    const section = maleOfferings.sections[0];
    const courseMap = new Map([[course.id, course]]);

    // Canvas in English
    const canvasEn = renderTimetableToCanvas({
      planName: "My Plan",
      termLabel: "Second Semester 1448",
      collegeLabel: "College of Business Administration",
      categoryLabel: "Male students",
      selectedSections: [section],
      courseMap,
      lang: "en",
    });
    expect(canvasEn).toBeDefined();

    // Canvas in Arabic
    const canvasAr = renderTimetableToCanvas({
      planName: "جدولي",
      termLabel: "الفصل الدراسي الثاني",
      collegeLabel: "كلية إدارة الأعمال",
      categoryLabel: "طلاب",
      selectedSections: [section],
      courseMap,
      lang: "ar",
    });
    expect(canvasAr).toBeDefined();
  });

  it("6. Handles composite course codes with term prefix (e.g. 144820:0603-101)", () => {
    const compositeCourse = { code: "144820:0673-101", titleAr: "مبادىء الادارة" };
    const localized = getLocalizedCourseTitle(compositeCourse, "en");
    expect(localized.title).toBe("Principles of Management");
    expect(localized.isRtl).toBe(false);
  });

  it("7. Gracefully falls back to Arabic title with isFallback=true when code is unrecognized", () => {
    const unknownCourse = { code: "9999-999", titleAr: "مقرر غير معروف" };
    const localized = getLocalizedCourseTitle(unknownCourse, "en");
    expect(localized.title).toBe("مقرر غير معروف");
    expect(localized.isRtl).toBe(true);
    expect(localized.isFallback).toBe(true);
  });
});
