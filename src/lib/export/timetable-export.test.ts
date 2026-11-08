import { describe, expect, it } from "vitest";
import { canvasToPdfBlob, generateSafeFilename, renderTimetableToCanvas } from "./timetable-export";
import type { Course, Section } from "@/lib/schema";

describe("Schedule Export & Filename Sanitizer", () => {
  it("generates safe, sanitized filenames for PDF and PNG", () => {
    expect(generateSafeFilename("My Plan 1", "144820", "pdf")).toBe("lemon-my-plan-1-144820.pdf");
    expect(generateSafeFilename("No Thursday Classes 😎!", "144820", "png")).toBe("lemon-no-thursday-classes--144820.png");
    expect(generateSafeFilename("   ", "144820", "pdf")).toBe("lemon-schedule-144820.pdf");
  });

  it("produces valid PDF 1.4 blob format from canvas", async () => {
    // Mock canvas toBlob
    const mockCanvas = {
      width: 800,
      height: 600,
      toBlob: (callback: (b: Blob | null) => void) => {
        // Return dummy JPEG bytes
        callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: "image/jpeg" }));
      },
    } as unknown as HTMLCanvasElement;

    const pdfBlob = await canvasToPdfBlob(mockCanvas);
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.type).toBe("application/pdf");

    const text = await pdfBlob.text();
    expect(text).toContain("%PDF-1.4");
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages");
    expect(text).toContain("startxref");
    expect(text).toContain("%%EOF");
  });

  it("handles canvas generation for both empty and populated schedules without throwing", () => {
    const dummyCourse: Course = {
      id: "144820:ACCT-101",
      termId: "144820",
      code: "ACCT-101",
      titleAr: "مبادئ المحاسبة",
      credits: 3,
    };
    const dummySection: Section = {
      id: "144820:63953",
      termId: "144820",
      courseId: "144820:ACCT-101",
      crn: "63953",
      sectionCode: "101",
      status: "open",
      meetings: [
        { id: "m1", days: ["sun", "tue"], startMinutes: 480, endMinutes: 530 },
      ],
      linkedSectionIds: [],
      provenance: { sourceUrl: "https://example.com", importedAt: "2026-11-08T00:00:00Z", sourceLabel: "KFU" },
    };

    const courseMap = new Map<string, Course>([[dummyCourse.id, dummyCourse]]);

    // Render populated canvas
    const canvas1 = renderTimetableToCanvas({
      planName: "My Plan 1",
      termLabel: "Second Semester",
      collegeLabel: "Business Administration",
      selectedSections: [dummySection],
      courseMap,
      isDarkTheme: false,
    });
    expect(canvas1.width).toBe(2200);
    expect(canvas1.height).toBe(1400);

    // Render empty schedule
    const canvas2 = renderTimetableToCanvas({
      planName: "Empty Plan",
      termLabel: "Second Semester",
      collegeLabel: "Business Administration",
      selectedSections: [],
      courseMap: new Map(),
      isDarkTheme: true,
    });
    expect(canvas2.width).toBe(2200);
    expect(canvas2.height).toBe(1400);

    // Render in Arabic RTL mode with metadata
    const canvasAr = renderTimetableToCanvas({
      planName: "جدولي الدراسي الأول",
      termLabel: "الفصل الدراسي الثاني",
      collegeLabel: "كلية إدارة الأعمال",
      categoryLabel: "طلاب",
      selectedSections: [
        {
          ...dummySection,
          instructor: { id: "inst-1", name: "د. عبدالمحسن القحطاني" },
        },
      ],
      courseMap,
      isDarkTheme: false,
      lang: "ar",
    });
    expect(canvasAr.width).toBe(2200);
    expect(canvasAr.height).toBe(1400);
  });
});
