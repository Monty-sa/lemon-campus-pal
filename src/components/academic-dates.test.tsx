import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RegistrationGuideModal } from "./registration-guide-modal";
import { getTranslations } from "@/lib/i18n";
import { VERIFIED_ACADEMIC_EVENTS_1448, KFU_OFFICIAL_CALENDAR_URL } from "@/data/academic-calendar";
import { getActiveOrUpcomingRegistrationEvent, getEventStatus, formatGregorianRange } from "@/lib/academic-calendar";

describe("LEMON-047: Smart Academic Dates in Registration Guide", () => {
  it("renders verified official 1448 AH events in Arabic", () => {
    const t = getTranslations("ar");
    render(
      <RegistrationGuideModal
        isOpen={true}
        onClose={() => {}}
        t={t}
        lang="ar"
      />
    );

    // Section title
    expect(screen.getByText(t.regGuide.academicDatesTitle, { exact: false })).toBeInTheDocument();
    
    // First active event: Early Registration
    expect(screen.getByText("التسجيل المبكر لمقررات الفصل الدراسي الثاني 1448هـ")).toBeInTheDocument();
    
    // Official link
    const link = screen.getByRole("link", { name: new RegExp(t.regGuide.academicDatesSourceLink) });
    expect(link).toHaveAttribute("href", KFU_OFFICIAL_CALENDAR_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders verified official 1448 AH events in English", () => {
    const t = getTranslations("en");
    render(
      <RegistrationGuideModal
        isOpen={true}
        onClose={() => {}}
        t={t}
        lang="en"
      />
    );

    // Section title
    expect(screen.getByText(t.regGuide.academicDatesTitle, { exact: false })).toBeInTheDocument();
    
    // English title
    expect(screen.getByText("Early Registration for Second Semester 1448 AH")).toBeInTheDocument();
    
    // Official link
    const link = screen.getByRole("link", { name: new RegExp(t.regGuide.academicDatesSourceLink) });
    expect(link).toHaveAttribute("href", KFU_OFFICIAL_CALENDAR_URL);
  });
});

describe("LEMON-047: Timetable Registration Deadline Banner", () => {
  it("identifies active registration event for current date (Nov 8, 2026)", () => {
    // Current date is 2026-11-08, which is inside 2026-11-08..2026-11-19
    const activeOrUpcoming = getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448, new Date("2026-11-08T12:00:00Z"));
    expect(activeOrUpcoming).not.toBeNull();
    expect(activeOrUpcoming?.id).toBe("kfu-1448-early-reg-s2");
    expect(getEventStatus(activeOrUpcoming!, new Date("2026-11-08T12:00:00Z"))).toBe("active");
  });

  it("correctly identifies upcoming registration event before start date", () => {
    const activeOrUpcoming = getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448, new Date("2026-11-05T00:00:00Z"));
    expect(activeOrUpcoming).not.toBeNull();
    expect(activeOrUpcoming?.id).toBe("kfu-1448-early-reg-s2");
    expect(getEventStatus(activeOrUpcoming!, new Date("2026-11-05T00:00:00Z"))).toBe("upcoming");
  });

  it("auto-hides when registration period has expired", () => {
    // After early registration closes on 2026-11-19, no other registration event exists in this semester
    const activeOrUpcoming = getActiveOrUpcomingRegistrationEvent(VERIFIED_ACADEMIC_EVENTS_1448, new Date("2026-11-20T00:00:00Z"));
    expect(activeOrUpcoming).toBeNull();
  });

  it("formats date ranges cleanly in both languages", () => {
    const rangeAr = formatGregorianRange("2026-11-08", "2026-11-19", "ar");
    expect(rangeAr).toContain("نوفمبر");
    const rangeEn = formatGregorianRange("2026-11-08", "2026-11-19", "en");
    expect(rangeEn).toContain("2026");
    expect(rangeEn).toContain("Nov");
  });
});
