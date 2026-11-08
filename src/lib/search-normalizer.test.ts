import { describe, expect, it } from "vitest";
import { matchesSearchText, normalizeSearchText } from "./search-normalizer";

describe("Arabic Search Normalizer (LEMON-029)", () => {
  it("normalizes Alef variants (أ, إ, آ, ٱ) to bare Alif (ا)", () => {
    expect(normalizeSearchText("إدارة")).toBe("اداره");
    expect(normalizeSearchText("أعمال")).toBe("اعمال");
    expect(normalizeSearchText("آداب")).toBe("اداب");
    expect(normalizeSearchText("ٱقتصاد")).toBe("اقتصاد");
  });

  it("removes tashkeel (diacritics) and tatweel (kashida)", () => {
    expect(normalizeSearchText("إِدَارَةُ الأَعْمَالِ")).toBe("اداره الاعمال");
    expect(normalizeSearchText("مَـحَـاسَـبَـة")).toBe("محاسبه");
  });

  it("normalizes Alef Maksura (ى) to Yeh (ي)", () => {
    expect(normalizeSearchText("مستوى")).toBe("مستوي");
    expect(normalizeSearchText("اقتصاديات الكلى")).toBe("اقتصاديات الكلي");
  });

  it("normalizes Teh Marbuta (ة) to Heh (ه)", () => {
    expect(normalizeSearchText("محاسبة")).toBe("محاسبه");
    expect(normalizeSearchText("مالية")).toBe("ماليه");
    expect(normalizeSearchText("كلية")).toBe("كليه");
  });

  it("normalizes hamza variant ىء to ئ", () => {
    expect(normalizeSearchText("مبادىء")).toBe("مبادئ");
    expect(normalizeSearchText("مبادئ")).toBe("مبادئ");
  });

  it("handles case-insensitive English/Latin and trims whitespace", () => {
    expect(normalizeSearchText("  AcCoUnTiNg 101  ")).toBe("accounting 101");
    expect(normalizeSearchText("CRN-63953")).toBe("crn-63953");
  });

  it("ensures 'ادارة' matches 'إدارة' via matchesSearchText", () => {
    const courseTitle = "0602-202 إدارة العمليات";
    expect(matchesSearchText(courseTitle, "ادارة")).toBe(true);
    expect(matchesSearchText(courseTitle, "إدارة")).toBe(true);
    expect(matchesSearchText(courseTitle, "إِدَارَة")).toBe(true);
    expect(matchesSearchText(courseTitle, "العمليات")).toBe(true);
    expect(matchesSearchText(courseTitle, "عمليات")).toBe(true);
    expect(matchesSearchText(courseTitle, "0602-202")).toBe(true);
    expect(matchesSearchText(courseTitle, "202")).toBe(true);
  });

  it("handles multi-token search queries regardless of token order", () => {
    const courseTitle = "0603-101 مبادىء المحاسبة (1)";
    expect(matchesSearchText(courseTitle, "مبادئ محاسبة")).toBe(true);
    expect(matchesSearchText(courseTitle, "محاسبة 101")).toBe(true);
    expect(matchesSearchText(courseTitle, "0603 مبادىء")).toBe(true);
  });

  it("preserves exact CRNs and course codes without accidental overmatching", () => {
    const haystack = "0602-101 63953 د. أحمد علي Management Principles";
    expect(matchesSearchText(haystack, "63953")).toBe(true);
    expect(matchesSearchText(haystack, "63954")).toBe(false);
    expect(matchesSearchText(haystack, "management")).toBe(true);
    expect(matchesSearchText(haystack, "احمد")).toBe(true);
    expect(matchesSearchText(haystack, "أحمد")).toBe(true);
    expect(matchesSearchText(haystack, "غير موجود")).toBe(false);
  });

  it("returns true on empty or whitespace queries", () => {
    expect(matchesSearchText("أي نص تجريبي", "")).toBe(true);
    expect(matchesSearchText("أي نص تجريبي", "   ")).toBe(true);
    expect(matchesSearchText("أي نص تجريبي", null)).toBe(true);
    expect(matchesSearchText("أي نص تجريبي", undefined)).toBe(true);
  });
});
