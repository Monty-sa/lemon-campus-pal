import { describe, expect, it } from "vitest";
import {
  calculateProjectedCumulativeGpa,
  calculateSemesterGpa,
  calculateTargetGpaFeasibility,
  getKfuStanding,
  KFU_GRADE_SCALE,
  loadSavedGpaScenarios,
  saveGpaScenarios,
} from "./calculator";
import type { GpaCourseInput, SavedGpaScenario } from "./types";

describe("KFU Official Grade Scale Weights (5.0 Scale)", () => {
  it("maps letter grades to exact KFU points", () => {
    expect(KFU_GRADE_SCALE["A+"].points).toBe(5.0);
    expect(KFU_GRADE_SCALE["A"].points).toBe(4.75);
    expect(KFU_GRADE_SCALE["B+"].points).toBe(4.5);
    expect(KFU_GRADE_SCALE["B"].points).toBe(4.0);
    expect(KFU_GRADE_SCALE["C+"].points).toBe(3.5);
    expect(KFU_GRADE_SCALE["C"].points).toBe(3.0);
    expect(KFU_GRADE_SCALE["D+"].points).toBe(2.5);
    expect(KFU_GRADE_SCALE["D"].points).toBe(2.0);
    expect(KFU_GRADE_SCALE["F"].points).toBe(1.0);
    expect(KFU_GRADE_SCALE["DN"].points).toBe(1.0);
  });

  it("marks special grades as excluded from GPA hours", () => {
    const nonGpa = ["NP", "NF", "IC", "IP", "W", "AU"] as const;
    for (const code of nonGpa) {
      expect(KFU_GRADE_SCALE[code].countsInGpa).toBe(false);
      expect(KFU_GRADE_SCALE[code].points).toBeNull();
    }
  });

  it("returns correct academic standings", () => {
    expect(getKfuStanding(4.85).standingEn).toBe("Excellent");
    expect(getKfuStanding(4.25).standingEn).toBe("Very Good");
    expect(getKfuStanding(3.20).standingEn).toBe("Good");
    expect(getKfuStanding(2.30).standingEn).toBe("Pass");
    expect(getKfuStanding(1.75).standingEn).toBe("Academic Warning");
  });
});

describe("Semester GPA Calculations", () => {
  it("calculates accurate semester GPA for standard courses", () => {
    const courses: GpaCourseInput[] = [
      { id: "1", code: "ACCT-101", credits: 3, grade: "A" }, // 3 * 4.75 = 14.25
      { id: "2", code: "ECON-101", credits: 3, grade: "B+" }, // 3 * 4.50 = 13.50
      { id: "3", code: "MATH-105", credits: 4, grade: "A+" }, // 4 * 5.00 = 20.00
      { id: "4", code: "ENG-101", credits: 2, grade: "B" }, // 2 * 4.00 = 8.00
    ];
    // Total credits: 12
    // Total points: 14.25 + 13.50 + 20.00 + 8.00 = 55.75
    // GPA = 55.75 / 12 = 4.645833... -> 4.65
    const result = calculateSemesterGpa(courses);
    expect(result.gpa).toBe(4.65);
    expect(result.totalCredits).toBe(12);
    expect(result.gpaCredits).toBe(12);
    expect(result.qualityPoints).toBe(55.75);
    expect(result.academicStandingEn).toBe("Excellent");
  });

  it("excludes non-GPA grades (W, NP, IC) from GPA calculation", () => {
    const courses: GpaCourseInput[] = [
      { id: "1", code: "MGMT-101", credits: 3, grade: "A+" }, // 3 * 5.0 = 15
      { id: "2", code: "PHYS-101", credits: 4, grade: "W" }, // Withdrawn, excluded
      { id: "3", code: "TRAIN-1", credits: 2, grade: "NP" }, // Pass no grade, excluded
    ];
    const result = calculateSemesterGpa(courses);
    expect(result.totalCredits).toBe(9);
    expect(result.gpaCredits).toBe(3);
    expect(result.qualityPoints).toBe(15.0);
    expect(result.gpa).toBe(5.0);
  });

  it("handles zero credit inputs safely without NaN", () => {
    const empty = calculateSemesterGpa([]);
    expect(empty.gpa).toBe(0.0);
    expect(empty.totalCredits).toBe(0);

    const zeroCreditsCourse: GpaCourseInput[] = [
      { id: "1", code: "TEST-0", credits: 0, grade: "A+" },
    ];
    const result = calculateSemesterGpa(zeroCreditsCourse);
    expect(result.gpa).toBe(0.0);
    expect(Number.isNaN(result.gpa)).toBe(false);
  });
});

describe("Projected Cumulative GPA Calculations", () => {
  it("blends previous GPA with current semester to calculate projected cumulative GPA", () => {
    // Previous: 60 hours completed with 4.00 GPA (60 * 4.0 = 240 quality points)
    const previous = { previousGpa: 4.0, previousHours: 60 };

    // Semester: 15 credits with 5.00 GPA (15 * 5.0 = 75 quality points)
    const semester = {
      gpa: 5.0,
      totalCredits: 15,
      gpaCredits: 15,
      qualityPoints: 75,
      academicStandingEn: "Excellent",
      academicStandingAr: "ممتاز",
    };

    // Total: 75 hours, 315 points -> 315 / 75 = 4.20
    const projected = calculateProjectedCumulativeGpa(previous, semester);
    expect(projected.cumulativeGpa).toBe(4.2);
    expect(projected.totalHours).toBe(75);
    expect(projected.totalQualityPoints).toBe(315);
    expect(projected.gpaChange).toBe(0.2); // +0.20 improvement
  });
});

describe("Target GPA Feasibility", () => {
  it("determines required semester GPA for achievable targets", () => {
    // 60 hours at 4.00 (240 points). Needs 4.20 cumulative after 15 credits.
    // (4.20 * 75 - 240) / 15 = (315 - 240) / 15 = 5.00
    const prev = { previousGpa: 4.0, previousHours: 60 };
    const feasibility = calculateTargetGpaFeasibility(prev, 15, 4.2);

    expect(feasibility.isFeasible).toBe(true);
    expect(feasibility.requiredSemesterGpa).toBe(5.0);
    expect(feasibility.feasibilityStatus).toBe("demanding");
  });

  it("identifies mathematically impossible targets exceeding 5.00", () => {
    // 60 hours at 3.00 (180 points). Wants 4.50 cumulative after 15 credits.
    // Required = (4.50 * 75 - 180) / 15 = (337.5 - 180) / 15 = 10.50 -> impossible!
    const prev = { previousGpa: 3.0, previousHours: 60 };
    const feasibility = calculateTargetGpaFeasibility(prev, 15, 4.5);

    expect(feasibility.isFeasible).toBe(false);
    expect(feasibility.feasibilityStatus).toBe("impossible");
    expect(feasibility.messageEn).toContain("Mathematically impossible");
  });

  it("recognizes targets already met", () => {
    const prev = { previousGpa: 4.8, previousHours: 60 };
    const feasibility = calculateTargetGpaFeasibility(prev, 15, 4.0);

    expect(feasibility.isFeasible).toBe(true);
    expect(feasibility.feasibilityStatus).toBe("already_met");
  });

  it("handles empty or invalid targets safely (LEMON-019)", () => {
    const prev = { previousGpa: 4.0, previousHours: 30 };

    // Zero or negative target
    const zeroTarget = calculateTargetGpaFeasibility(prev, 12, 0);
    expect(zeroTarget.isFeasible).toBe(false);
    expect(zeroTarget.feasibilityStatus).toBe("impossible");
    expect(zeroTarget.messageEn).toContain("Please enter a valid target");

    // Target exceeding 5.0
    const overTarget = calculateTargetGpaFeasibility(prev, 12, 5.5);
    expect(overTarget.isFeasible).toBe(false);
    expect(overTarget.feasibilityStatus).toBe("impossible");
    expect(overTarget.messageEn).toContain("Maximum cumulative GPA at KFU is 5.00");

    // 0 credit hours
    const zeroCredits = calculateTargetGpaFeasibility(prev, 0, 4.5);
    expect(zeroCredits.isFeasible).toBe(false);
    expect(zeroCredits.feasibilityStatus).toBe("impossible");
    expect(zeroCredits.messageEn).toContain("Cannot change GPA with 0 semester credit hours");
  });
});

describe("Guest Scenarios Local Persistence", () => {
  it("round-trips GPA scenarios in local storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
    };

    expect(loadSavedGpaScenarios(storage)).toEqual([]);

    const scenarios: SavedGpaScenario[] = [
      {
        id: "scen-1",
        name: "Spring Target Plan",
        previousGpa: 4.15,
        previousHours: 45,
        courses: [{ id: "c1", code: "FIN-201", credits: 3, grade: "A" }],
        updatedAt: "2026-11-08T00:00:00Z",
      },
    ];

    saveGpaScenarios(storage, scenarios);
    const loaded = loadSavedGpaScenarios(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe("Spring Target Plan");
  });
});
