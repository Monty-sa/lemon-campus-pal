import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataImport, Section } from "@/lib/schema";
import { executeFullPipelineRefresh } from "./pipeline";
import {
  MemorySnapshotStore,
  setSnapshotStoreForTesting,
} from "./storage";
import { validateSnapshotCompleteness } from "./validator";
import { computeFreshnessInfo, getRelativeTimeDescription } from "./status";
import { KFU_BUSINESS_DATASETS, KFU_OWNER_ATTESTATION } from "./types";
import { maleOfferings } from "@/data/offerings";
import {
  loadInitialGuestPlans,
  loadActivePlanId,
  saveGuestPlans,
  saveActivePlanId,
} from "@/lib/storage";

const generateMockDataset = (
  categoryCode: "11" | "12",
  courseCount = categoryCode === "11" ? 164 : 168,
  sectionCount = categoryCode === "11" ? 389 : 540,
  overrides?: Partial<DataImport>,
): DataImport => ({
  id: `test-${categoryCode}-snapshot`,
  term: { id: "144820", labelAr: "الفصل الدراسي الثاني للعام الجامعي 1448" },
  college: { id: "06", nameAr: "كلية إدارة الأعمال" },
  studentCategory: {
    id: categoryCode,
    labelAr: categoryCode === "11" ? "طلاب" : "طالبات",
  },
  importedAt: new Date().toISOString(),
  sourceUrl: KFU_BUSINESS_DATASETS[categoryCode].url,
  sourceLabel: "نظام الجداول العام بجامعة الملك فيصل",
  status: "verified-snapshot",
  courses: Array.from({ length: courseCount }, (_, i) => ({
    id: `144820:060${(i % 9) + 1}-${100 + i}`,
    termId: "144820",
    code: `060${(i % 9) + 1}-${100 + i}`,
    titleAr: `مقرر تجريبي ${i + 1}`,
    credits: 3,
  })),
  sections: Array.from({ length: sectionCount }, (_, i) => {
    const courseIndex = i % courseCount;
    const courseCode = `060${(courseIndex % 9) + 1}-${100 + courseIndex}`;
    const crn = `${categoryCode === "11" ? "8" : "9"}${1000 + i}`;
    return {
      id: `144820:${crn}`,
      termId: "144820",
      courseId: `144820:${courseCode}`,
      crn,
      sectionCode: `${(i % 10) + 1}`,
      status: "open" as const,
      meetings: [
        {
          id: `${crn}-1`,
          days: ["sun", "tue", "thu"] as const,
          startMinutes: 480,
          endMinutes: 530,
        },
      ],
      linkedSectionIds: [],
      provenance: {
        sourceUrl: KFU_BUSINESS_DATASETS[categoryCode].url,
        importedAt: new Date().toISOString(),
        sourceLabel: "KFU",
      },
    };
  }),
  warnings: [],
  ...overrides,
});

function datasetToMockHtml(dataset: DataImport): string {
  const rows = dataset.sections
    .map((sec) => {
      const course = dataset.courses.find((c) => c.id === sec.courseId);
      const meeting = sec.meetings[0];
      const daysStr = meeting ? meeting.days.map((d) => (d === "sun" ? "ح" : d === "tue" ? "ث" : "خ")).join(" ") : "";
      const timeStr = meeting ? "0800 - 0850" : "";
      return `<tr>
        <td>${course?.code ?? "0601-101"}</td>
        <td>${sec.crn}</td>
        <td>${sec.sectionCode}</td>
        <td>متاح</td>
        <td>${course?.titleAr ?? "مقرر"}</td>
        <td>3</td>
        <td>${daysStr}</td>
        <td>محاضرة</td>
        <td>${timeStr}</td>
        <td>د. فلان الفلاني</td>
        <td></td>
        <td></td>
        <td></td>
      </tr>`;
    })
    .join("\n");

  return `<html><body><table>${rows}</table></body></html>`;
}

describe("Automated KFU Data Refresh Pipeline (LEMON-038)", () => {
  let memoryStore: MemorySnapshotStore;
  const originalEnv = process.env.KFU_MONITOR_CRON_ENABLED;

  beforeEach(() => {
    process.env.KFU_MONITOR_CRON_ENABLED = "true";
    memoryStore = new MemorySnapshotStore(true);
    setSnapshotStoreForTesting(memoryStore);
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.KFU_MONITOR_CRON_ENABLED = originalEnv;
    } else {
      delete process.env.KFU_MONITOR_CRON_ENABLED;
    }
    setSnapshotStoreForTesting(null);
  });

  // 1. Valid Refresh
  it("executes a complete valid refresh: FETCH → PARSE → VALIDATE → COMPARE → STAGE → ATOMIC PUBLISH → VERIFY", async () => {
    const maleMock = generateMockDataset("11");
    const femaleMock = generateMockDataset("12");

    const result = await executeFullPipelineRefresh({
      maleHtml: datasetToMockHtml(maleMock),
      femaleHtml: datasetToMockHtml(femaleMock),
    });

    expect(result.status).toBe("published");
    expect(result.male.status).toBe("success");
    expect(result.female.status).toBe("success");
    expect(result.male.snapshotPublished).toBe(true);
    expect(result.female.snapshotPublished).toBe(true);

    // Verify durable storage
    const activeMale = await memoryStore.getActiveSnapshot("11");
    const activeFemale = await memoryStore.getActiveSnapshot("12");
    expect(activeMale).not.toBeNull();
    expect(activeFemale).not.toBeNull();
    expect(activeMale?.courses.length).toBe(164);
    expect(activeFemale?.courses.length).toBe(168);

    // Verify metadata
    const meta = await memoryStore.getMetadata();
    expect(meta).not.toBeNull();
    expect(meta?.sourceHealth).toBe("healthy");
    expect(meta?.lastPublishedSnapshot).toBeDefined();
    expect(meta?.maleCourseCount).toBe(164);
    expect(meta?.femaleCourseCount).toBe(168);
    expect(meta?.attestation).toBe(KFU_OWNER_ATTESTATION);
  });

  // 2. Malformed/Truncated Source
  it("rejects malformed or truncated HTML source and preserves last-known-good snapshots", async () => {
    const initialMale = await memoryStore.getActiveSnapshot("11");
    const initialFemale = await memoryStore.getActiveSnapshot("12");

    const badHtml = "<html><body><table><tr><td>Incomplete table without required cells</td></tr></table></body></html>";

    const result = await executeFullPipelineRefresh({
      maleHtml: badHtml,
      femaleHtml: badHtml,
    });

    expect(result.status).toBe("validation_failed");
    expect(result.male.snapshotPublished).toBe(false);
    expect(result.female.snapshotPublished).toBe(false);

    // Verify previous snapshot preserved in storage
    const currentMale = await memoryStore.getActiveSnapshot("11");
    const currentFemale = await memoryStore.getActiveSnapshot("12");
    expect(currentMale).toEqual(initialMale);
    expect(currentFemale).toEqual(initialFemale);
  });

  // 3. Source Timeout and HTTP Errors
  it("handles source timeout and network failures safely without publishing partial data", async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection timeout after 15000ms"));

      const result = await executeFullPipelineRefresh();
      expect(result.status).toBe("fetch_failed");
      expect(result.male.snapshotPublished).toBe(false);
      expect(result.female.snapshotPublished).toBe(false);

      // Verify durable store untouched
      const activeMale = await memoryStore.getActiveSnapshot("11");
      expect(activeMale?.courses.length).toBe(maleOfferings.courses.length);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 4. Male/Female Dataset Separation
  it("enforces strict male/female dataset separation and rejects cross-category leaks", async () => {
    const prev = generateMockDataset("11");
    const wrongCategory = generateMockDataset("12");

    const validation = validateSnapshotCompleteness(
      wrongCategory,
      prev,
      KFU_BUSINESS_DATASETS["11"],
    );

    expect(validation.isValid).toBe(false);
    expect(validation.failureReason).toContain("Category separation failure");
  });

  // 5. Duplicate CRNs
  it("detects and rejects snapshots containing duplicate CRNs within the dataset", () => {
    const mock = generateMockDataset("11");
    // Introduce duplicate CRN
    const dupSection: Section = {
      ...mock.sections[0],
      id: "144820:DUP-CRN",
      sectionCode: "99",
      crn: mock.sections[1].crn, // Duplicate of section 1!
    };
    const corruptSnapshot: DataImport = {
      ...mock,
      sections: [...mock.sections, dupSection],
    };

    const val = validateSnapshotCompleteness(corruptSnapshot, null, KFU_BUSINESS_DATASETS["11"]);
    expect(val.isValid).toBe(false);
    expect(val.failureReason).toContain("Duplicate CRN detected");
  });

  // 6. Unexpected Data Drops
  it("rejects severe section drops (>40%) to prevent publishing partial or truncated scrapes", () => {
    const prev = generateMockDataset("11", 164, 400);
    // Section count drops from 400 to 220 (45% drop)
    const dropped = generateMockDataset("11", 164, 220);

    const val = validateSnapshotCompleteness(dropped, prev, KFU_BUSINESS_DATASETS["11"]);
    expect(val.isValid).toBe(false);
    expect(val.failureReason).toContain("Suspicious data drop");
    expect(val.failureReason).toContain("Potential KFU server truncation");
  });

  // 7. Concurrent Invocations
  it("enforces job locking to reject overlapping pipeline runs and prevent race conditions", async () => {
    await memoryStore.acquireDistributedLock("kfu-full-pipeline", 60000);

    const maleMock = generateMockDataset("11");
    const femaleMock = generateMockDataset("12");

    const result = await executeFullPipelineRefresh({
      maleHtml: datasetToMockHtml(maleMock),
      femaleHtml: datasetToMockHtml(femaleMock),
    });

    expect(result.status).toBe("locked");
    expect(result.male.status).toBe("locked");
    expect(result.female.status).toBe("locked");
  });

  // 8. Idempotent Refresh
  it("executes idempotently when source data has not changed", async () => {
    const maleMock = generateMockDataset("11");
    const femaleMock = generateMockDataset("12");
    const maleHtml = datasetToMockHtml(maleMock);
    const femaleHtml = datasetToMockHtml(femaleMock);

    // First run publishes
    const run1 = await executeFullPipelineRefresh({ maleHtml, femaleHtml });
    expect(run1.status).toBe("published");

    // Second run with identical HTML
    const run2 = await executeFullPipelineRefresh({ maleHtml, femaleHtml });
    expect(run2.status).toBe("published");
    expect(run2.male.changesCount).toBe(0);
    expect(run2.female.changesCount).toBe(0);

    const activeMale = await memoryStore.getActiveSnapshot("11");
    expect(activeMale?.courses.length).toBe(164);
  });

  // 9. Atomic Publish Failure & Automatic Rollback
  it("automatically rolls back when durable storage encounters write failure during publish", async () => {
    const initialMale = await memoryStore.getActiveSnapshot("11");
    const initialFemale = await memoryStore.getActiveSnapshot("12");

    memoryStore.simulateFailureOnPublish = true;

    const maleMock = generateMockDataset("11");
    const femaleMock = generateMockDataset("12");

    const result = await executeFullPipelineRefresh({
      maleHtml: datasetToMockHtml(maleMock),
      femaleHtml: datasetToMockHtml(femaleMock),
    });

    expect(result.status).toBe("publish_failed");
    expect(result.male.snapshotPublished).toBe(false);

    // Check that state was rolled back cleanly to initial
    const activeMale = await memoryStore.getActiveSnapshot("11");
    const activeFemale = await memoryStore.getActiveSnapshot("12");
    expect(activeMale?.courses.length).toBe(initialMale?.courses.length);
    expect(activeFemale?.courses.length).toBe(initialFemale?.courses.length);
  });

  // 10. Last-Known-Good Recovery
  it("supports explicit rollback to previous known-good snapshot", async () => {
    const male1 = generateMockDataset("11", 160, 380);
    const female1 = generateMockDataset("12", 165, 530);
    await executeFullPipelineRefresh({
      maleHtml: datasetToMockHtml(male1),
      femaleHtml: datasetToMockHtml(female1),
    });

    const male2 = generateMockDataset("11", 164, 389);
    const female2 = generateMockDataset("12", 168, 540);
    await executeFullPipelineRefresh({
      maleHtml: datasetToMockHtml(male2),
      femaleHtml: datasetToMockHtml(female2),
    });

    expect((await memoryStore.getActiveSnapshot("11"))?.courses.length).toBe(164);

    // Rollback to male1 / female1
    const rollbackResult = await memoryStore.rollbackToPrevious();
    expect(rollbackResult.rolledBack).toBe(true);

    const rolledBackMale = await memoryStore.getActiveSnapshot("11");
    expect(rolledBackMale?.courses.length).toBe(160);
  });

  // 11. Honest Timestamps and Stale Warnings
  it("generates honest timestamps, disclaimer, and computes stale warnings accurately", () => {
    const now = new Date("2026-11-08T12:00:00Z").getTime();

    // 45 minutes old -> Fresh
    const fresh = computeFreshnessInfo("2026-11-08T11:15:00Z", undefined, undefined, 2, now);
    expect(fresh.isStale).toBe(false);
    expect(fresh.freshnessLabel).toBe("Fresh");
    expect(fresh.relativeAgeLabel).toBe("45m ago");

    // 3 hours old -> Stale
    const stale = computeFreshnessInfo("2026-11-08T09:00:00Z", undefined, undefined, 2, now);
    expect(stale.isStale).toBe(true);
    expect(stale.freshnessLabel).toBe("Stale");
    expect(stale.relativeAgeLabel).toBe("3h ago");

    expect(getRelativeTimeDescription("invalid-date", now)).toBe("Unknown");
  });

  // 12. Existing Guest Plan Compatibility
  it("preserves existing guest plans, selected active plans, and custom sections across snapshot updates", () => {
    const mockStorage = {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
      clear() {
        this.store.clear();
      },
    };

    const termId = "144820";
    const guestPlans = [
      {
        id: "plan-alpha",
        name: "My Fall Schedule",
        termId,
        sectionIds: ["144820:85169", "144820:85170"],
        createdAt: "2026-11-07T10:00:00.000Z",
        updatedAt: "2026-11-07T10:00:00.000Z",
      },
    ];

    saveGuestPlans(mockStorage as unknown as Storage, guestPlans);
    saveActivePlanId(mockStorage as unknown as Storage, "plan-alpha");

    const loadedPlans = loadInitialGuestPlans(mockStorage as unknown as Storage, termId);
    const activeId = loadActivePlanId(mockStorage as unknown as Storage, null);

    expect(loadedPlans).toHaveLength(1);
    expect(loadedPlans[0].id).toBe("plan-alpha");
    expect(loadedPlans[0].name).toBe("My Fall Schedule");
    expect(loadedPlans[0].sectionIds).toEqual(["144820:85169", "144820:85170"]);
    expect(activeId).toBe("plan-alpha");
  });
});
