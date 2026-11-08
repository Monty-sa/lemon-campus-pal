import { describe, expect, it } from "vitest";
import { offerings } from "@/data/offerings";
import { DEFAULT_AUTO_SCHEDULE_PREFERENCES, generateSchedules } from "./auto-schedule";

describe("deterministic schedule generation", () => {
  it("returns conflict-free open combinations in stable ranked order", () => {
    const courseIds = offerings.courses.slice(0, 2).map(c => c.id);
    const a = generateSchedules(offerings, courseIds, DEFAULT_AUTO_SCHEDULE_PREFERENCES);
    const b = generateSchedules(offerings, courseIds, DEFAULT_AUTO_SCHEDULE_PREFERENCES);
    expect(a.schedules).toEqual(b.schedules);
    expect(a.schedules.length).toBeLessThanOrEqual(5);
    expect(a.schedules.every(s => s.sectionIds.length === 2)).toBe(true);
  });
  it("uses the KFU 09:00 soft preference and reports no hard-filter matches honestly", () => {
    expect(DEFAULT_AUTO_SCHEDULE_PREFERENCES.preferredEarliestMinutes).toBe(540);
    const impossible = {...DEFAULT_AUTO_SCHEDULE_PREFERENCES, hardEarliestMinutes: 1430};
    const result = generateSchedules(offerings, [offerings.courses[0].id], impossible);
    expect(result.schedules).toHaveLength(0);
    expect(result.warnings.join(" ")).toContain("No sections satisfy");
  });
  it("reports additional pages when valid combinations exceed the requested result count", () => {
    const courseIds = ["144820:0603-101", "144820:0603-103"];
    const prefs = { ...DEFAULT_AUTO_SCHEDULE_PREFERENCES, resultCount: 3 as const, openOnly: false };
    const first = generateSchedules(offerings, courseIds, prefs);
    const second = generateSchedules(offerings, courseIds, prefs, first.schedules.length);

    expect(first.schedules).toHaveLength(3);
    expect(first.hasMore).toBe(true);
    expect(second.schedules.length).toBeGreaterThan(0);
    expect(second.schedules[0].sectionIds).not.toEqual(first.schedules[0].sectionIds);
  });
});
