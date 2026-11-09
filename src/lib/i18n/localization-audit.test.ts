import { describe, expect, it } from "vitest";
import { femaleOfferings, maleOfferings } from "@/data/offerings";
import { getLocalizedCourseTitle, VERIFIED_ENGLISH_COURSE_TITLES } from "./course-titles";
import { filterSections, DEFAULT_FILTERS } from "@/lib/explorer-filters";
import { renderTimetableToCanvas } from "@/lib/export/timetable-export";
import { getTranslations } from "./dictionary";
import fs from "node:fs";
import path from "node:path";

function collectTranslationLeaves(value: unknown, prefix = ""): Map<string, unknown> {
  const leaves = new Map<string, unknown>();
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTranslationLeaves(item, `${prefix}.${index}`).forEach((v, k) => leaves.set(k, v)));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectTranslationLeaves(child, prefix ? `${prefix}.${key}` : key).forEach((v, k) => leaves.set(k, v));
    }
  } else {
    leaves.set(prefix, value);
  }
  return leaves;
}

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory()
      ? collectSourceFiles(target)
      : /\.(?:ts|tsx|js|jsx|json)$/.test(entry.name)
        ? [target]
        : [];
  });
}

describe("LEMON-041 Complete Arabic / English Localization Audit", () => {
  it("keeps localization sources valid UTF-8 and free of mojibake or replacement characters", () => {
    const suspect = /(?:Ã.|Â.|Ø[\u00a0-\u00ff]|Ù[\u00a0-\u00ff]|â(?:€|€™|€œ|€¦|€“|€”))|\uFFFD/;
    for (const file of [...collectSourceFiles("src"), ...collectSourceFiles("data")].filter((name) => !name.includes(".test."))) {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(fs.readFileSync(file));
      expect(source, `${file} contains invalid localization text`).not.toMatch(suspect);
    }
  });

  it("keeps Arabic and English translation keys and value types aligned", () => {
    const en = collectTranslationLeaves(getTranslations("en"));
    const ar = collectTranslationLeaves(getTranslations("ar"));
    expect([...ar.keys()].sort()).toEqual([...en.keys()].sort());
    for (const [key, value] of en) expect(typeof ar.get(key), key).toBe(typeof value);
  });

  it("allows only reviewed shared labels and bilingual day-code fields", () => {
    const en = collectTranslationLeaves(getTranslations("en"));
    const ar = collectTranslationLeaves(getTranslations("ar"));
    const shared = [...en].filter(([key, value]) => typeof value === "string" && value === ar.get(key)).map(([key]) => key).sort();
    const approved = [
      "auth.emailPlaceholder", "common.arabic", "common.english", "common.githubLink",
      "onboarding.arabicLabel", "onboarding.englishLabel", "planner.step1", "planner.step2",
      ...[0, 1, 2, 3, 4].flatMap((index) => [`regGuide.daysMap.${index}.code`, `regGuide.daysMap.${index}.en`, `regGuide.daysMap.${index}.name`]),
    ].sort();
    expect(shared).toEqual(approved);
  });

  it("flags unlocalized Arabic dictionary strings, allowing only intentional English labels and hidden day metadata", () => {
    const leaves = collectTranslationLeaves(getTranslations("ar"));
    const latinOnly = [...leaves].filter(([, value]) =>
      typeof value === "string" && /[A-Za-z]{2}/.test(value) && !/[\u0600-\u06ff]/.test(value),
    ).map(([key]) => key).sort();
    const approved = [
      "auth.emailPlaceholder", "common.english", "common.githubLink", "onboarding.englishLabel",
      ...[0, 1, 2, 3, 4].map((index) => `regGuide.daysMap.${index}.en`),
    ].sort();
    expect(latinOnly).toEqual(approved);
  });

  it("preserves dynamic interpolation in every bilingual translation function", () => {
    const en = collectTranslationLeaves(getTranslations("en"));
    const ar = collectTranslationLeaves(getTranslations("ar"));
    const normalizeDigits = (value: string) => value
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[\s,٬]/g, "");
    for (const [key, value] of en) {
      if (typeof value !== "function") continue;
      const translated = ar.get(key);
      expect(typeof translated, key).toBe("function");
      const run = (fn: (...args: number[]) => unknown) => {
        const args = Array.from({ length: fn.length }, (_, index) => 731_429 + index * 101);
        const result = String(fn(...args));
        expect(result, key).not.toMatch(/undefined|NaN|\[object Object\]/);
        for (const arg of args) expect(normalizeDigits(result), `${key} dropped argument ${arg}`).toContain(String(arg));
      };
      run(value as (...args: number[]) => unknown);
      run(translated as (...args: number[]) => unknown);
    }
  });

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
