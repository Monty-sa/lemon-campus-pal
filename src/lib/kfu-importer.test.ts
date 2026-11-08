import { describe, expect, it } from "vitest";
import { parseKfuHtml } from "./kfu-importer";

const header = "<tr><th>رقم المقرر</th><th>CRN</th><th>الشعبة</th><th>الحالة</th><th>المقرر</th><th>ساعات</th><th>الأيام</th><th>النشاط</th><th>الوقت</th><th>المدرس</th><th>السابق</th><th>الكليات</th><th>التخصصات</th></tr>";
const row = (cells: string[]) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`;
const options = { termId: "144820", collegeCode: "06", categoryCode: "11", sourceUrl: "https://example.com/ws" };

describe("KFU importer", () => {
  it("groups multiple source rows into meetings for one CRN", () => {
    const html = `<table>${header}${row(["0602-202","63953","T1","غير متاحه","إدارة العمليات","3","ث","نظري","0730 - 0845","","0606-201","06","0602"])}${row(["0602-202","63953","T1","غير متاحه","إدارة العمليات","3","ح","نظري","0900 - 1015","","0606-201","06","0602"])}</table>`;
    const result = parseKfuHtml(html, { ...options, importedAt: "2026-11-07T00:00:00.000Z" });
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].meetings).toHaveLength(2);
    expect(result.sections[0].instructor).toBeUndefined();
  });

  it("skips incomplete imported rows", () => {
    const html = `<table>${header}${row(["0602-202","","T1","متاحه","","x","ح","نظري","0900 - 1015","","","06",""])}</table>`;
    const result = parseKfuHtml(html, { ...options, importedAt: "2026-11-07T00:00:00.000Z" });
    expect(result.sections).toEqual([]);
  });

  it("keeps a section with no published meeting and records a warning", () => {
    const html = `<table>${header}${row(["0603-302","53210","01","غير متاحه","المحاسبة الادارية","3","","نظري","-","","","06",""])}</table>`;
    const result = parseKfuHtml(html, { ...options, importedAt: "2026-11-07T00:00:00.000Z" });
    expect(result.sections[0].meetings).toEqual([]);
    expect(result.warnings[0]).toContain("53210");
  });

  it("maps open and closed source statuses without treating them as capacity", () => {
    const html = `<table>${header}${row(["0602-202","1","T1","متاحه","مقرر مفتوح","3","ح","نظري","0900 - 1015","","","06",""])}${row(["0602-203","2","T1","غير متاحه","مقرر مغلق","3","ن","نظري","1030 - 1145","","","06",""])}</table>`;
    const result = parseKfuHtml(html, { ...options, importedAt: "2026-11-07T00:00:00.000Z" });
    expect(result.sections.map((section) => section.status)).toEqual(["open", "closed"]);
    expect(result.sections.every((section) => section.capacity === undefined)).toBe(true);
  });

  it("uses only metadata mappings verified from the official selector", () => {
    const html = `<table>${header}${row(["0602-202","1","T1","متاحه","مقرر","3","ح","نظري","0900 - 1015","","","06",""])}</table>`;
    const result = parseKfuHtml(html, { ...options, importedAt: "2026-11-07T00:00:00.000Z" });
    expect(result.term.labelAr).toBe("الفصل الدراسي الثاني للعام الجامعي 1448");
    expect(result.college.nameAr).toBe("كلية إدارة الأعمال");
    expect(result.studentCategory).toEqual({ id: "11", labelAr: "طلاب" });
  });
});
