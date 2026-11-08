import { describe, expect, it } from "vitest";
import {
  getRiyadhDateString,
  getEventStatus,
  getActiveOrUpcomingRegistrationEvent,
  formatGregorianRange,
} from "./academic-calendar";
import {
  VERIFIED_ACADEMIC_EVENTS_1448,
  KFU_OFFICIAL_CALENDAR_URL,
  type AcademicCalendarEvent,
} from "@/data/academic-calendar";

describe("LEMON-047: Smart Academic Dates & Calendar Engine", () => {
  it("computes Asia/Riyadh date string correctly accounting for UTC+3", () => {
    // 2026-11-08 22:00 UTC is 2026-11-09 01:00 in Riyadh (UTC+3)
    const lateUtcDate = new Date("2026-11-08T22:30:00Z");
    expect(getRiyadhDateString(lateUtcDate)).toBe("2026-11-09");

    // 2026-11-08 15:00 UTC is 2026-11-08 18:00 in Riyadh
    const dayUtcDate = new Date("2026-11-08T15:00:00Z");
    expect(getRiyadhDateString(dayUtcDate)).toBe("2026-11-08");
  });

  it("determines active, upcoming, and finished statuses correctly", () => {
    const mockEvent: AcademicCalendarEvent = {
      id: "test-reg",
      titleAr: "التسجيل المبكر",
      titleEn: "Early Registration",
      category: "registration",
      startDate: "2026-11-08",
      endDate: "2026-11-19",
      semester: "2",
      academicYear: "1448",
      sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
      verifiedAt: "2026-11-08T18:00:00Z",
    };

    // Before start date
    const beforeDate = new Date("2026-11-07T12:00:00Z");
    expect(getEventStatus(mockEvent, beforeDate)).toBe("upcoming");

    // First day of event (in Riyadh timezone)
    const startDate = new Date("2026-11-08T12:00:00Z");
    expect(getEventStatus(mockEvent, startDate)).toBe("active");

    // Middle of event
    const midDate = new Date("2026-11-15T12:00:00Z");
    expect(getEventStatus(mockEvent, midDate)).toBe("active");

    // Last day of event
    const lastDay = new Date("2026-11-19T20:00:00Z");
    expect(getEventStatus(mockEvent, lastDay)).toBe("active");

    // After end date
    const afterDate = new Date("2026-11-20T12:00:00Z");
    expect(getEventStatus(mockEvent, afterDate)).toBe("finished");
  });

  it("picks the active registration event or next upcoming event", () => {
    const now = new Date("2026-11-08T18:00:00Z"); // Nov 8 in Riyadh
    const active = getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448, now);
    expect(active).not.toBeNull();
    expect(active?.id).toBe("kfu-1448-early-reg-s2");
    expect(active?.startDate).toBe("2026-11-08");
  });

  it("automatically hides and returns null when all events have expired", () => {
    const futureDate = new Date("2028-01-01T12:00:00Z");
    const active = getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448, futureDate);
    expect(active).toBeNull();
  });

  it("formats localized date ranges cleanly in Arabic and English", () => {
    const en = formatGregorianRange("2026-11-08", "2026-11-19", "en");
    expect(en).toContain("Nov");
    expect(en).toContain("8");
    expect(en).toContain("19");

    const ar = formatGregorianRange("2026-11-08", "2026-11-19", "ar");
    expect(ar).toBeTruthy();
  });

  it("validates official calendar data integrity and attributes", () => {
    expect(VERIFIED_ACADEMIC_EVENTS_1448.length).toBeGreaterThan(0);
    for (const event of VERIFIED_ACADEMIC_EVENTS_1448) {
      expect(event.sourceUrl).toBe(KFU_OFFICIAL_CALENDAR_URL);
      expect(event.academicYear).toBe("1448");
      expect(event.startDate <= event.endDate).toBe(true);
      expect(event.titleAr.length).toBeGreaterThan(5);
      expect(event.titleEn.length).toBeGreaterThan(5);
    }
  });
});
