import { createHmac } from "node:crypto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadPlans,
  loadInitialGuestPlans,
  validateBackupFileContent,
  type GuestDataBackup,
  type LemonBackupV2,
} from "./storage";
import {
  calculateSemesterGpa,
  calculateProjectedCumulativeGpa,
  calculateTargetGpaFeasibility,
  getKfuStanding,
  KFU_GRADE_SCALE,
} from "./gpa/calculator";
import {
  meetingsOverlap,
  findConflicts,
  hasConflictWithSections,
  addSectionToPlan,
} from "./schedule";
import { normalizeSearchText } from "./search-normalizer";
import {
  verifyOAuthState,
  isOwnerAuthorized,
  verifyAdminSessionToken,
} from "./admin/auth";
import {
  validateSnapshotCompleteness,
} from "./kfu-monitor/validator";
import type { Day, SchedulePlan, Section } from "./schema";
import type { DataImport } from "./schema";

const defaultProvenance = {
  sourceUrl: "https://ssb-ar.kfu.edu.sa/ws?p_sex_code=11",
  importedAt: "2026-11-08T00:00:00.000Z",
  sourceLabel: "KFU Test Data",
};

describe("LEMON-051 Phase 2-7: Deep Robustness, Adversarial & Boundary Test Suite", () => {
  describe("1. Corrupted LocalStorage & Backup File Validation Defense", () => {
    it("handles corrupted JSON, primitive values, and invalid schema in loadPlans without crashing", () => {
      const corruptStorage = (val: string) => ({
        getItem: () => val,
      });

      // Malformed JSON syntax
      expect(loadPlans(corruptStorage("{{broken json"))).toEqual([]);
      // Primitive types instead of array
      expect(loadPlans(corruptStorage("12345"))).toEqual([]);
      expect(loadPlans(corruptStorage("\"a string\""))).toEqual([]);
      expect(loadPlans(corruptStorage("true"))).toEqual([]);
      expect(loadPlans(corruptStorage("{}"))).toEqual([]);
      expect(loadPlans(corruptStorage("null"))).toEqual([]);
      // Array of non-plan objects
      expect(loadPlans(corruptStorage("[1, 2, 3]"))).toEqual([]);
      expect(loadPlans(corruptStorage("[{\"id\": 123}]"))).toEqual([]);
      expect(loadPlans(corruptStorage("[{\"id\": \"plan-1\"}]"))).toEqual([]); // Missing name and sectionIds
    });

    it("handles corrupted storage in loadInitialGuestPlans safely", () => {
      const corruptStorage = {
        getItem: () => "{bad-json:",
      };
      expect(loadInitialGuestPlans(corruptStorage, "144820")).toEqual([]);
    });

    it("strictly rejects malformed, oversized, or tampered backup files in validateBackupFileContent", () => {
      // Empty or whitespace
      expect(validateBackupFileContent("").isValid).toBe(false);
      expect(validateBackupFileContent("   ").isValid).toBe(false);

      // Oversized (> 5MB)
      const hugeString = "a".repeat(5 * 1024 * 1024 + 1);
      const sizeRes = validateBackupFileContent(hugeString);
      expect(sizeRes.isValid).toBe(false);
      expect(sizeRes.error).toContain("exceeds 5MB");

      // Corrupted JSON
      expect(validateBackupFileContent("{invalid json").isValid).toBe(false);

      // Array at root instead of object
      expect(validateBackupFileContent("[]").isValid).toBe(false);

      // Unsupported versions
      expect(validateBackupFileContent(JSON.stringify({ version: 0, plans: [] })).isValid).toBe(false);
      expect(validateBackupFileContent(JSON.stringify({ version: 99, plans: [] })).isValid).toBe(false);

      // Missing or invalid plans array
      expect(validateBackupFileContent(JSON.stringify({ version: 2 })).isValid).toBe(false);
      expect(validateBackupFileContent(JSON.stringify({ version: 2, plans: "not-an-array" })).isValid).toBe(false);

      // Invalid plan objects inside backup
      expect(validateBackupFileContent(JSON.stringify({ version: 2, plans: [{ id: "" }] })).isValid).toBe(false);
      expect(validateBackupFileContent(JSON.stringify({ version: 2, plans: [{ id: "p1", name: "", sectionIds: [] }] })).isValid).toBe(false);
      expect(validateBackupFileContent(JSON.stringify({ version: 2, plans: [{ id: "p1", name: "Valid", sectionIds: [123] }] })).isValid).toBe(false);

      // Valid V1 backup
      const validV1: GuestDataBackup = {
        version: 1,
        exportedAt: new Date().toISOString(),
        plans: [
          {
            id: "v1-plan",
            name: "Plan A",
            termId: "144820",
            sectionIds: ["144820:101"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      const v1Res = validateBackupFileContent(JSON.stringify(validV1));
      expect(v1Res.isValid).toBe(true);
      expect(v1Res.backup?.plans).toHaveLength(1);

      // Valid V2 backup
      const validV2: LemonBackupV2 = {
        version: 2,
        appName: "LEMON",
        schemaVersion: "2.0",
        exportedAt: new Date().toISOString(),
        plans: [
          {
            id: "v2-plan",
            name: "Plan B",
            termId: "144820",
            sectionIds: ["144820:202"],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        preferences: {
          category: "11",
          viewMode: "cards",
          theme: "system",
          language: "ar",
        },
      };
      const v2Res = validateBackupFileContent(JSON.stringify(validV2));
      expect(v2Res.isValid).toBe(true);
      expect(v2Res.backup?.preferences?.language).toBe("ar");
    });
  });

  describe("2. GPA Calculation Edge Cases & Numerical Precision", () => {
    it("handles zero credits and courses with divide-by-zero protection", () => {
      // Empty course list
      const emptyRes = calculateSemesterGpa([]);
      expect(emptyRes.gpa).toBe(0);
      expect(emptyRes.totalCredits).toBe(0);
      expect(emptyRes.gpaCredits).toBe(0);
      expect(emptyRes.qualityPoints).toBe(0);

      // Courses with 0 credits (e.g. non-credit seminar)
      const zeroCreditRes = calculateSemesterGpa([
        { id: "c1", code: "SEM101", credits: 0, grade: "A+" },
      ]);
      expect(zeroCreditRes.gpa).toBe(0);
      expect(zeroCreditRes.totalCredits).toBe(0);
      expect(zeroCreditRes.gpaCredits).toBe(0);
      expect(zeroCreditRes.qualityPoints).toBe(0);
      expect(Number.isNaN(zeroCreditRes.gpa)).toBe(false);
    });

    it("correctly excludes non-GPA grades (NP, NF, IC, IP, W, AU) from GPA and points", () => {
      const mixedRes = calculateSemesterGpa([
        { id: "c1", code: "ENGL101", credits: 3, grade: "A+" }, // 3 * 5.0 = 15
        { id: "c2", code: "MATH101", credits: 3, grade: "W" },  // Withdrawn: excluded
        { id: "c3", code: "PHYS101", credits: 4, grade: "IP" }, // In Progress: excluded
        { id: "c4", code: "CHEM101", credits: 2, grade: "NP" }, // Pass No-Grade: excluded
        { id: "c5", code: "ARAB101", credits: 2, grade: "IC" }, // Incomplete: excluded
      ]);

      expect(mixedRes.totalCredits).toBe(14); // 3 + 3 + 4 + 2 + 2
      expect(mixedRes.gpaCredits).toBe(3);   // only ENGL101
      expect(mixedRes.qualityPoints).toBe(15.0);
      expect(mixedRes.gpa).toBe(5.0);
    });

    it("verifies exact KFU point scale for all grade letters", () => {
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

    it("verifies precise academic standing boundary classifications", () => {
      expect(getKfuStanding(5.0).standingEn).toBe("Excellent");
      expect(getKfuStanding(4.5).standingEn).toBe("Excellent");
      expect(getKfuStanding(4.49).standingEn).toBe("Very Good");
      expect(getKfuStanding(3.75).standingEn).toBe("Very Good");
      expect(getKfuStanding(3.74).standingEn).toBe("Good");
      expect(getKfuStanding(2.75).standingEn).toBe("Good");
      expect(getKfuStanding(2.74).standingEn).toBe("Pass");
      expect(getKfuStanding(2.0).standingEn).toBe("Pass");
      expect(getKfuStanding(1.99).standingEn).toBe("Academic Warning");
      expect(getKfuStanding(1.0).standingEn).toBe("Academic Warning");
      expect(getKfuStanding(0.0).standingEn).toBe("Academic Warning");
    });

    it("handles cumulative projected GPA calculation when previous hours are 0 or negative", () => {
      const semester = calculateSemesterGpa([
        { id: "1", code: "MGMT101", credits: 3, grade: "B" }, // 3 * 4.0 = 12
      ]);

      const cumNoPrev = calculateProjectedCumulativeGpa(
        { previousHours: 0, previousGpa: 0 },
        semester,
      );
      expect(cumNoPrev.cumulativeGpa).toBe(4.0);
      expect(cumNoPrev.totalHours).toBe(3);
      expect(cumNoPrev.totalQualityPoints).toBe(12.0);

      const cumNegativeHours = calculateProjectedCumulativeGpa(
        { previousHours: -10, previousGpa: 3.5 },
        semester,
      );
      expect(cumNegativeHours.totalHours).toBe(3);
    });

    it("handles target GPA feasibility edge cases: impossible targets and zero credits", () => {
      // Impossible target > 5.0
      const impossibleHigh = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 3.0 }, 15, 5.01);
      expect(impossibleHigh.isFeasible).toBe(false);
      expect(impossibleHigh.feasibilityStatus).toBe("impossible");

      // Invalid negative or 0 target
      const invalidTarget = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 3.0 }, 15, -1);
      expect(invalidTarget.isFeasible).toBe(false);

      // Zero semester credits when target is already met
      const zeroCredsMet = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 4.0 }, 0, 3.5);
      expect(zeroCredsMet.isFeasible).toBe(true);
      expect(zeroCredsMet.feasibilityStatus).toBe("already_met");

      // Zero semester credits when target is higher than current
      const zeroCredsUnmet = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 3.0 }, 0, 4.0);
      expect(zeroCredsUnmet.isFeasible).toBe(false);
      expect(zeroCredsUnmet.feasibilityStatus).toBe("impossible");

      // Target requiring > 5.0 in semester
      const requiresOver5 = calculateTargetGpaFeasibility({ previousHours: 100, previousGpa: 2.0 }, 12, 4.0);
      expect(requiresOver5.isFeasible).toBe(false);
      expect(requiresOver5.feasibilityStatus).toBe("impossible");

      // Achievable target (< 4.5)
      const achievable = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 3.8 }, 15, 4.0);
      expect(achievable.isFeasible).toBe(true);
      expect(achievable.feasibilityStatus).toBe("achievable");
      expect(achievable.requiredSemesterGpa).toBe(4.4);

      // Demanding target (>= 4.5)
      const demanding = calculateTargetGpaFeasibility({ previousHours: 30, previousGpa: 3.8 }, 15, 4.1);
      expect(demanding.isFeasible).toBe(true);
      expect(demanding.feasibilityStatus).toBe("demanding");
      expect(demanding.requiredSemesterGpa).toBe(4.7);
    });
  });

  describe("3. Schedule Conflict & Boundary Intersections", () => {
    it("does not flag back-to-back classes as a conflict (endMinutes === other.startMinutes)", () => {
      const sectionA: Section = {
        id: "144820:1001",
        termId: "144820",
        courseId: "144820:0601-101",
        crn: "1001",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: defaultProvenance,
        meetings: [
          {
            id: "1001-1",
            days: ["sun", "tue", "thu"],
            startMinutes: 480, // 08:00
            endMinutes: 530,   // 08:50
          },
        ],
      };

      const sectionB: Section = {
        id: "144820:1002",
        termId: "144820",
        courseId: "144820:0601-102",
        crn: "1002",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: defaultProvenance,
        meetings: [
          {
            id: "1002-1",
            days: ["sun", "tue", "thu"],
            startMinutes: 530, // 08:50 (exact back-to-back boundary)
            endMinutes: 580,   // 09:40
          },
        ],
      };

      expect(meetingsOverlap(sectionA.meetings[0], sectionB.meetings[0])).toBe(false);
      expect(findConflicts([sectionA, sectionB])).toHaveLength(0);
      expect(hasConflictWithSections(sectionB, [sectionA])).toBe(false);
    });

    it("flags 1-minute overlap as an exact conflict", () => {
      const meetingA = {
        id: "m1",
        days: ["sun"] as Day[],
        startMinutes: 480,
        endMinutes: 531, // Overlaps by 1 minute with 530
      };

      const meetingB = {
        id: "m2",
        days: ["sun"] as Day[],
        startMinutes: 530,
        endMinutes: 580,
      };

      expect(meetingsOverlap(meetingA, meetingB)).toBe(true);
    });

    it("does not flag same time on different days as a conflict", () => {
      const meetingSun = {
        id: "m1",
        days: ["sun", "tue"] as Day[],
        startMinutes: 480,
        endMinutes: 530,
      };

      const meetingMon = {
        id: "m2",
        days: ["mon", "wed"] as Day[],
        startMinutes: 480,
        endMinutes: 530,
      };

      expect(meetingsOverlap(meetingSun, meetingMon)).toBe(false);
    });

    it("safely handles Time TBA sections with empty meetings array without crashing", () => {
      const tbaSection: Section = {
        id: "144820:9999",
        termId: "144820",
        courseId: "144820:0601-999",
        crn: "9999",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: defaultProvenance,
        meetings: [], // TBA
      };

      const regularSection: Section = {
        id: "144820:1001",
        termId: "144820",
        courseId: "144820:0601-101",
        crn: "1001",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: defaultProvenance,
        meetings: [
          {
            id: "m1",
            days: ["sun"] as Day[],
            startMinutes: 480,
            endMinutes: 530,
          },
        ],
      };

      expect(hasConflictWithSections(tbaSection, [regularSection])).toBe(false);
      expect(findConflicts([tbaSection, regularSection])).toHaveLength(0);
    });

    it("strictly prevents mixing male and female sections within the same plan in addSectionToPlan", () => {
      const basePlan: SchedulePlan = {
        id: "test-plan",
        name: "Plan A",
        termId: "144820",
        sectionIds: ["144820:male-1"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const maleSection: Section = {
        id: "144820:male-1",
        termId: "144820",
        courseId: "c1",
        crn: "1111",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: {
          sourceUrl: "https://ssb-ar.kfu.edu.sa/ws?p_sex_code=11",
          importedAt: "2026-11-08T00:00:00.000Z",
          sourceLabel: "KFU Male Section",
        },
        meetings: [],
      };

      const femaleSection: Section = {
        id: "144820:female-1",
        termId: "144820",
        courseId: "c2",
        crn: "2222",
        sectionCode: "01",
        status: "open",
        linkedSectionIds: [],
        provenance: {
          sourceUrl: "https://ssb-ar.kfu.edu.sa/ws?p_sex_code=12",
          importedAt: "2026-11-08T00:00:00.000Z",
          sourceLabel: "KFU Female Section",
        },
        meetings: [],
      };

      expect(() => addSectionToPlan(basePlan, femaleSection, [maleSection])).toThrow(
        /Cannot mix male and female sections/,
      );
    });
  });

  describe("4. Search Normalizer & Unicode Hardening", () => {
    it("normalizes Arabic text with complex tashkeel, hamzas, tatweel, and common variations", () => {
      // Tashkeel removal & taa marbuta: مُحَاسَبَة -> محاسبه
      expect(normalizeSearchText("مُحَاسَبَة")).toBe("محاسبه");

      // Hamza normalization: إدارة / أعمال / آراء -> اداره / اعمال / اراء
      expect(normalizeSearchText("إدارة")).toBe("اداره");
      expect(normalizeSearchText("أعمال")).toBe("اعمال");
      expect(normalizeSearchText("آراء")).toBe("اراء");

      // Taa marbuta normalization: مالية -> ماليه
      expect(normalizeSearchText("مَالِيَّة")).toBe("ماليه");

      // Tatweel removal: مـــــحـاسـبـة -> محاسبة -> محاسبه
      expect(normalizeSearchText("مـــــحـاسـبـة")).toBe("محاسبه");

      // Whitespace collapsing
      expect(normalizeSearchText("محاسبة   مالية")).toBe("محاسبه ماليه");
    });

    it("processes very large queries (10,000 characters) without regex catastrophic backtracking", () => {
      const largeInput = "مقرر ".repeat(2000);
      const start = Date.now();
      const result = normalizeSearchText(largeInput);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // Must execute in < 100ms
      expect(result).toBeTruthy();
    });
  });

  describe("5. Admin Security & CSRF State Defense", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        ADMIN_GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
        ADMIN_GOOGLE_CLIENT_SECRET: "test-client-secret",
        ADMIN_SESSION_SECRET: "test-session-secret-64-characters-for-hmac-sha256-cryptography!",
        ADMIN_OWNER_EMAILS: "Owner@kfu.edu.sa, SecondOwner@gmail.com",
      };
    });

    it("verifies case-insensitive email matching and rejects unauthorized emails", () => {
      expect(isOwnerAuthorized("owner@kfu.edu.sa")).toBe(true);
      expect(isOwnerAuthorized("OWNER@KFU.EDU.SA")).toBe(true);
      expect(isOwnerAuthorized("secondowner@gmail.com")).toBe(true);

      // Rejects non-owners
      expect(isOwnerAuthorized("attacker@malicious.com")).toBe(false);
      expect(isOwnerAuthorized("owner@kfu.edu.sa.attacker.com")).toBe(false);
      expect(isOwnerAuthorized("")).toBe(false);
    });

    it("enforces immutable Google Sub IDs when configured", () => {
      process.env.ADMIN_OWNER_SUBS = "118234567890123456789";

      // Email matches but sub is missing or wrong -> rejected
      expect(isOwnerAuthorized("owner@kfu.edu.sa", undefined)).toBe(false);
      expect(isOwnerAuthorized("owner@kfu.edu.sa", "999999999999999999999")).toBe(false);

      // Both email and sub match -> authorized
      expect(isOwnerAuthorized("owner@kfu.edu.sa", "118234567890123456789")).toBe(true);
    });

    it("rejects tampered, expired, or mismatched CSRF OAuth states in verifyOAuthState", () => {
      const validSecret = process.env.ADMIN_SESSION_SECRET!;
      // Null, empty, or mismatched state
      expect(verifyOAuthState(null, "some-cookie")).toBe(false);
      expect(verifyOAuthState("state", null)).toBe(false);
      expect(verifyOAuthState("stateA", "stateB")).toBe(false);

      // Malformed state without signature
      expect(verifyOAuthState("rawStateWithoutDot", "rawStateWithoutDot")).toBe(false);

      // Expired state (timestamp in the past)
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const rawExpired = `test-nonce:${pastTime}`;
      const expiredSig = createHmac("sha256", validSecret).update(rawExpired).digest("base64url");
      const expiredState = `${rawExpired}.${expiredSig}`;

      expect(verifyOAuthState(expiredState, expiredState)).toBe(false);

      // Tampered signature
      const validRaw = `test-nonce:${Math.floor(Date.now() / 1000) + 300}`;
      const forgedState = `${validRaw}.forged_signature_deadbeef`;
      expect(verifyOAuthState(forgedState, forgedState)).toBe(false);
    });

    it("rejects tampered or expired session cookies in verifyAdminSessionToken", () => {
      expect(verifyAdminSessionToken(null)).toBeNull();
      expect(verifyAdminSessionToken("")).toBeNull();
      expect(verifyAdminSessionToken("invalid-token-no-dot")).toBeNull();
      expect(verifyAdminSessionToken("payload.bad-sig")).toBeNull();
    });
  });

  describe("6. KFU Ingestion Contract & Validator Defense", () => {
    const validMaleSnapshot: DataImport = {
      id: "snapshot-11",
      term: { id: "144820", labelAr: "الفصل الثاني 1448" },
      college: { id: "06", nameAr: "كلية إدارة الأعمال" },
      studentCategory: { id: "11", labelAr: "طلاب" },
      sourceUrl: "https://ssb-ar.kfu.edu.sa/ws?p_sex_code=11",
      sourceLabel: "KFU Male Offerings",
      status: "verified-snapshot",
      importedAt: new Date().toISOString(),
      courses: Array.from({ length: 60 }, (_, i) => ({
        id: `144820:0601-${100 + i}`,
        termId: "144820",
        code: `0601-${100 + i}`,
        titleAr: `مقرر ${i}`,
        credits: 3,
      })),
      sections: Array.from({ length: 250 }, (_, i) => {
        const cIdx = i % 60;
        return {
          id: `144820:8${1000 + i}`,
          termId: "144820",
          courseId: `144820:0601-${100 + cIdx}`,
          crn: `8${1000 + i}`,
          sectionCode: "01",
          status: "open" as const,
          linkedSectionIds: [],
          provenance: defaultProvenance,
          meetings: [
            {
              id: `m-${i}`,
              days: ["sun", "tue"] as Day[],
              startMinutes: 480,
              endMinutes: 530,
            },
          ],
        };
      }),
      warnings: [],
    };

    it("accepts a fully compliant KFU snapshot dataset", () => {
      const res = validateSnapshotCompleteness(validMaleSnapshot);
      expect(res.isValid).toBe(true);
      expect(res.status).toBe("valid");
    });

    it("rejects snapshot with term mismatch", () => {
      const tampered = { ...validMaleSnapshot, term: { id: "144710", labelAr: "قديم" } };
      const res = validateSnapshotCompleteness(tampered);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("Term mismatch");
    });

    it("rejects snapshot with college mismatch", () => {
      const tampered = { ...validMaleSnapshot, college: { id: "09", nameAr: "كلية أخرى" } };
      const res = validateSnapshotCompleteness(tampered);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("College mismatch");
    });

    it("rejects snapshot with fewer courses than minimum threshold (50)", () => {
      const tampered = { ...validMaleSnapshot, courses: validMaleSnapshot.courses.slice(0, 30) };
      const res = validateSnapshotCompleteness(tampered);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("minimum required: 50");
    });

    it("rejects snapshot with fewer sections than minimum threshold (200)", () => {
      const tampered = { ...validMaleSnapshot, sections: validMaleSnapshot.sections.slice(0, 100) };
      const res = validateSnapshotCompleteness(tampered);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("minimum required: 200");
    });

    it("rejects snapshot with duplicate CRNs", () => {
      const duplicated = {
        ...validMaleSnapshot,
        sections: [...validMaleSnapshot.sections, { ...validMaleSnapshot.sections[0], id: "144820:dup" }],
      };
      const res = validateSnapshotCompleteness(duplicated);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("Duplicate CRN detected");
    });

    it("rejects snapshot with orphan sections referencing nonexistent courses", () => {
      const orphan = {
        ...validMaleSnapshot,
        sections: [
          ...validMaleSnapshot.sections,
          {
            id: "144820:orphan",
            termId: "144820",
            courseId: "nonexistent-course-id",
            crn: "99999",
            sectionCode: "01",
            status: "open" as const,
            linkedSectionIds: [],
            provenance: defaultProvenance,
            meetings: [{ id: "m", days: ["sun" as Day], startMinutes: 480, endMinutes: 530 }],
          },
        ],
      };
      const res = validateSnapshotCompleteness(orphan);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("Orphan section detected");
    });

    it("rejects snapshot with inverted or invalid meeting times (startMinutes >= endMinutes)", () => {
      const invalidTime = {
        ...validMaleSnapshot,
        sections: [
          {
            ...validMaleSnapshot.sections[0],
            meetings: [
              {
                id: "m-inv",
                days: ["sun" as const],
                startMinutes: 600,
                endMinutes: 500, // Inverted!
              },
            ],
          },
          ...validMaleSnapshot.sections.slice(1),
        ],
      };
      const res = validateSnapshotCompleteness(invalidTime);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("Malformed meeting schedule");
    });

    it("rejects suspicious partial scrape drop (>40% drop in sections)", () => {
      // 400 sections in previous snapshot
      const prev = {
        ...validMaleSnapshot,
        sections: Array.from({ length: 400 }, (_, i) => ({
          ...validMaleSnapshot.sections[0],
          id: `144820:8${2000 + i}`,
          crn: `8${2000 + i}`,
        })),
      };

      // 220 sections in current snapshot (passes MIN_SECTIONS 200, but is a 45% drop from 400)
      const dropped = {
        ...validMaleSnapshot,
        sections: Array.from({ length: 220 }, (_, i) => ({
          ...validMaleSnapshot.sections[0],
          id: `144820:8${3000 + i}`,
          crn: `8${3000 + i}`,
        })),
      };

      const res = validateSnapshotCompleteness(dropped, prev);
      expect(res.isValid).toBe(false);
      expect(res.failureReason).toContain("Suspicious data drop");
    });
  });
});
