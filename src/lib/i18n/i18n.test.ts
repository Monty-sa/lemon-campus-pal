import { beforeEach, describe, expect, it } from "vitest";
import {
  ar,
  en,
  getLanguageDirection,
  getLocalizedCourseTitle,
  getStoredLanguage,
  getTranslations,
  isLanguage,
  LANGUAGE_STORAGE_KEY,
  setStoredLanguage,
  VERIFIED_ENGLISH_COURSE_TITLES,
} from "./index";

describe("LEMON-021 & LEMON-025 Localization (i18n)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("provides comprehensive translation dictionaries for both en and ar", () => {
    expect(en.common.brandTag).toBe("Your Campus Pal.");
    expect(ar.common.brandTag).toBe("خويّك الجامعي.");

    expect(en.categorySelector.label).toBe("Student Category");
    expect(ar.categorySelector.label).toBe("فئة الطلاب");

    expect(en.table.crn).toBe("CRN");
    expect(ar.table.crn).toBe("الرمز (CRN)");

    expect(en.gpa.title).toContain("GPA Calculator");
    expect(ar.gpa.title).toContain("حاسبة المعدل");
  });

  it("verifies LEMON-025 Saudi-friendly natural Arabic microcopy", () => {
    expect(ar.planner.heroTitleLine1).toBe("رتّب جدولك");
    expect(ar.planner.heroTitleLine2).toBe("على كيفك. 🍋");
    expect(ar.planner.heroEyebrow).toBe("خويّك الجامعي ✨");
    expect(ar.planner.browseSectionsTitle).toBe("تصفّح الشعب");
    expect(ar.planner.addSectionToPlan).toBe("أضف لجدولي");
    expect(ar.planner.removeSectionFromPlan).toBe("احذف من الجدول");
    expect(ar.planner.conflictBannerTitle).toBe("انتبه، فيه تعارض بالجدول! ⚠️");
    expect(ar.planner.emptyScheduleTitle).toBe("أسبوعك فاضي ومرتاح! 📅");
    expect(ar.planner.copyCrns).toBe("نسخ أرقام الـ CRN");
    expect(ar.planner.planNamePlaceholder).toBe("مثال: جدول بدون دوام خميس 😎");
    expect(ar.filters.cardsView).toBe("بطاقات");
    expect(ar.filters.tableView).toBe("جدول");
  });

  it("handles valid language validation and direction lookup", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("ar")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
    expect(isLanguage(null)).toBe(false);

    expect(getLanguageDirection("en")).toBe("ltr");
    expect(getLanguageDirection("ar")).toBe("rtl");
  });

  it("persists and retrieves language preference from localStorage without requiring login", () => {
    expect(getStoredLanguage()).toBe("en"); // Default is English

    setStoredLanguage("ar");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ar");
    expect(getStoredLanguage()).toBe("ar");

    setStoredLanguage("en");
    expect(getStoredLanguage()).toBe("en");
  });

  it("resolves translations cleanly for both languages", () => {
    const enDict = getTranslations("en");
    const arDict = getTranslations("ar");

    expect(enDict.planner.weeklySchedule).toBe("Weekly Schedule");
    expect(arDict.planner.weeklySchedule).toBe("الجدول الأسبوعي");

    expect(enDict.categorySelector.maleFull(389)).toContain("389");
    expect(arDict.categorySelector.maleFull(389)).toContain("389");
    expect(enDict.categorySelector.femaleFull(540)).toContain("540");
    expect(arDict.categorySelector.femaleFull(540)).toContain("540");
  });

  it("localizes course titles with verified English titles and falls back safely to Arabic with bidi isolation", () => {
    // 0602-202 is Operations Management
    const mgmtCourse = {
      code: "0602-202",
      titleAr: "إدارة العمليات",
    };

    const enResult = getLocalizedCourseTitle(mgmtCourse, "en");
    expect(enResult.title).toBe(VERIFIED_ENGLISH_COURSE_TITLES["0602-202"]);
    expect(enResult.isRtl).toBe(false);
    expect(enResult.isFallback).toBe(false);

    const arResult = getLocalizedCourseTitle(mgmtCourse, "ar");
    expect(arResult.title).toBe("إدارة العمليات");
    expect(arResult.isRtl).toBe(true);

    // Unmapped course falls back to Arabic with isRtl=true and isFallback=true
    const unmappedCourse = {
      code: "9999-999",
      titleAr: "مقرر غير معروف",
    };
    const fallbackResult = getLocalizedCourseTitle(unmappedCourse, "en");
    expect(fallbackResult.title).toBe("مقرر غير معروف");
    expect(fallbackResult.isRtl).toBe(true);
    expect(fallbackResult.isFallback).toBe(true);
  });
});
