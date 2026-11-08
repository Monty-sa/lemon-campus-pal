import { describe, expect, it } from "vitest";
import type { Course, SchedulePlan, Section, SectionMeeting } from "./schema";
import { addSectionToPlan, calculateCredits, findConflicts, hasConflictWithSections, meetingsOverlap } from "./schedule";

const provenance = { sourceUrl: "https://example.com", importedAt: "2026-11-07T00:00:00.000Z", sourceLabel: "test" };
const meeting = (id: string, days: SectionMeeting["days"], startMinutes: number, endMinutes: number): SectionMeeting => ({ id, days, startMinutes, endMinutes });
const section = (id: string, courseId: string, meetings: SectionMeeting[], termId = "t1", linkedSectionIds: string[] = []): Section => ({
  id, termId, courseId, crn: id, sectionCode: "1", status: "open", meetings, linkedSectionIds, provenance,
});
const plan = (termId = "t1"): SchedulePlan => ({ id: "p1", name: "Plan", termId, sectionIds: [], createdAt: "2026-11-07T00:00:00.000Z", updatedAt: "2026-11-07T00:00:00.000Z" });

describe("schedule conflicts", () => {
  it("detects a single-meeting overlap", () => {
    const conflicts = findConflicts([
      section("a", "c1", [meeting("a1", ["sun"], 540, 600)]),
      section("b", "c2", [meeting("b1", ["sun"], 570, 630)]),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ day: "sun", startMinutes: 570, endMinutes: 600 });
  });

  it("detects a conflict in any block of a multi-meeting section", () => {
    const conflicts = findConflicts([
      section("a", "c1", [meeting("a1", ["sun"], 480, 540), meeting("a2", ["tue"], 720, 780)]),
      section("b", "c2", [meeting("b1", ["tue"], 750, 810)]),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].day).toBe("tue");
  });

  it("does not treat adjacent classes as overlapping", () => {
    expect(meetingsOverlap(meeting("a", ["mon"], 600, 660), meeting("b", ["mon"], 660, 720))).toBe(false);
  });

  it("does not conflict on different days at the same hour", () => {
    expect(findConflicts([
      section("a", "c1", [meeting("a", ["sun"], 600, 660)]),
      section("b", "c2", [meeting("b", ["mon"], 600, 660)]),
    ])).toEqual([]);
  });

  it("reports one conflict for each shared day in a multi-day meeting", () => {
    const conflicts = findConflicts([
      section("a", "c1", [meeting("a", ["sun", "tue"], 600, 660)]),
      section("b", "c2", [meeting("b", ["sun", "tue"], 600, 660)]),
    ]);
    expect(conflicts.map((conflict) => conflict.day)).toEqual(["sun", "tue"]);
  });

  it("detects identical-time sections of the same course", () => {
    const conflicts = findConflicts([
      section("a", "c1", [meeting("a", ["wed"], 720, 795)]),
      section("b", "c1", [meeting("b", ["wed"], 720, 795)]),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ startMinutes: 720, endMinutes: 795 });
  });

  it("detects a one-minute overlap", () => {
    expect(meetingsOverlap(meeting("a", ["thu"], 600, 661), meeting("b", ["thu"], 660, 720))).toBe(true);
  });

  it("does not compare meetings across academic terms", () => {
    expect(findConflicts([
      section("a", "c1", [meeting("a", ["sun"], 600, 660)], "t1"),
      section("b", "c2", [meeting("b", ["sun"], 600, 660)], "t2"),
    ])).toEqual([]);
  });
});

describe("plan rules", () => {
  it("prevents duplicate section selection", () => {
    const target = section("s1", "c1", []);
    const once = addSectionToPlan(plan(), target);
    expect(addSectionToPlan(once, target).sectionIds).toEqual(["s1"]);
  });

  it("prevents cross-term scheduling", () => {
    expect(() => addSectionToPlan(plan("t1"), section("s1", "c1", [], "t2"))).toThrow(/different semester/);
  });

  it("counts a course once when two of its sections are present", () => {
    const courses: Course[] = [{ id: "c1", termId: "t1", code: "101", titleAr: "مقرر", credits: 3 }];
    expect(calculateCredits([section("s1", "c1", []), section("s2", "c1", [])], courses)).toBe(3);
  });

  it("counts different courses independently", () => {
    const courses: Course[] = [
      { id: "c1", termId: "t1", code: "101", titleAr: "الأول", credits: 3 },
      { id: "c2", termId: "t1", code: "102", titleAr: "الثاني", credits: 1 },
    ];
    expect(calculateCredits([section("s1", "c1", []), section("s2", "c2", [])], courses)).toBe(4);
  });

  it("retains linked section identifiers when represented", () => {
    expect(section("lecture", "c1", [], "t1", ["lab"]).linkedSectionIds).toEqual(["lab"]);
  });

  it("prevents mixing male and female sections within the same plan (LEMON-011B)", () => {
    const maleSection: Section = {
      ...section("m1", "c1", []),
      provenance: { sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=t1&p_col_code=06&p_sex_code=11", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
    };
    const femaleSection: Section = {
      ...section("f1", "c2", []),
      provenance: { sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=t1&p_col_code=06&p_sex_code=12", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
    };

    const initialPlan: SchedulePlan = {
      id: "p1",
      name: "Plan",
      termId: "t1",
      sectionIds: ["m1"],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };

    // Attempting to add female section to a plan containing male section
    expect(() =>
      addSectionToPlan(initialPlan, femaleSection, [maleSection]),
    ).toThrow("Cannot mix male and female sections within the same schedule plan");

    // Adding another male section succeeds
    const anotherMale: Section = {
      ...section("m2", "c2", []),
      provenance: { sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=t1&p_col_code=06&p_sex_code=11", importedAt: "2026-01-01T00:00:00Z", sourceLabel: "KFU" },
    };
    const updated = addSectionToPlan(initialPlan, anotherMale, [maleSection]);
    expect(updated.sectionIds).toEqual(["m1", "m2"]);
  });

  it("checks whether a candidate section conflicts with existing plan sections", () => {
    const existing = [section("s1", "c1", [meeting("m1", ["sun"], 540, 600)])];
    const conflicting = section("s2", "c2", [meeting("m2", ["sun"], 570, 630)]);
    const nonConflicting = section("s3", "c3", [meeting("m3", ["sun"], 600, 660)]);

    expect(hasConflictWithSections(conflicting, existing)).toBe(true);
    expect(hasConflictWithSections(nonConflicting, existing)).toBe(false);
  });
});
