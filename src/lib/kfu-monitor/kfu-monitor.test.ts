import { describe, expect, it } from "vitest";
import type { DataImport, Section } from "@/lib/schema";
import { computeSnapshotDiff } from "./diff";
import { validateSnapshotCompleteness } from "./validator";
import { computeFreshnessInfo, getRelativeTimeDescription } from "./status";
import {
  acquireJobLock,
  executeDatasetRefresh,
  isCronExecutionApproved,
  releaseJobLock,
} from "./pipeline";

const sampleImport = (overrides?: Partial<DataImport>): DataImport => ({
  id: "test-snapshot-1",
  term: { id: "144820", labelAr: "الفصل الثاني 1448" },
  college: { id: "06", nameAr: "كلية إدارة الأعمال" },
  studentCategory: { id: "11", labelAr: "طلاب" },
  importedAt: "2026-11-07T12:00:00.000Z",
  sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11",
  sourceLabel: "KFU",
  status: "verified-snapshot",
  courses: Array.from({ length: 60 }, (_, i) => ({
    id: `144820:COURSE-${i + 1}`,
    termId: "144820",
    code: `COURSE-${i + 1}`,
    titleAr: `مقرر تجريبي ${i + 1}`,
    credits: 3,
  })),
  sections: Array.from({ length: 250 }, (_, i) => ({
    id: `144820:6000${i}`,
    termId: "144820",
    courseId: `144820:COURSE-${(i % 60) + 1}`,
    crn: `6000${i}`,
    sectionCode: `${(i % 5) + 1}`,
    status: "open" as const,
    meetings: [
      {
        id: `m-${i}`,
        days: ["sun", "tue", "thu"],
        startMinutes: 480,
        endMinutes: 530,
      },
    ],
    linkedSectionIds: [],
    provenance: {
      sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11",
      importedAt: "2026-11-07T12:00:00.000Z",
      sourceLabel: "KFU",
    },
  })),
  warnings: [],
  ...overrides,
});

describe("KFU Monitor Diff Engine", () => {
  it("detects availability change (open -> closed)", () => {
    const prev = sampleImport();
    const curr = sampleImport({
      sections: prev.sections.map((sec, idx) =>
        idx === 0 ? { ...sec, status: "closed" } : sec,
      ),
    });

    const diffs = computeSnapshotDiff(prev, curr);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].changeType).toBe("availability_changed");
    expect(diffs[0].crn).toBe(prev.sections[0].crn);
    expect(diffs[0].oldVal?.status).toBe("open");
    expect(diffs[0].newVal?.status).toBe("closed");
  });

  it("detects schedule time and meeting changes", () => {
    const prev = sampleImport();
    const curr = sampleImport({
      sections: prev.sections.map((sec, idx) =>
        idx === 1
          ? {
              ...sec,
              meetings: [
                {
                  id: "m-updated",
                  days: ["mon", "wed"],
                  startMinutes: 600,
                  endMinutes: 675,
                },
              ],
            }
          : sec,
      ),
    });

    const diffs = computeSnapshotDiff(prev, curr);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].changeType).toBe("schedule_changed");
    expect(diffs[0].crn).toBe(prev.sections[1].crn);
  });

  it("detects added and cancelled sections", () => {
    const prev = sampleImport();
    // Remove section 0 (cancelled) and add section 9999 (added)
    const newSection: Section = {
      id: "144820:9999",
      termId: "144820",
      courseId: "144820:COURSE-1",
      crn: "9999",
      sectionCode: "99",
      status: "open",
      meetings: [],
      linkedSectionIds: [],
      provenance: prev.sections[0].provenance,
    };

    const curr = sampleImport({
      sections: [...prev.sections.slice(1), newSection],
    });

    const diffs = computeSnapshotDiff(prev, curr);
    const added = diffs.find((d) => d.changeType === "added");
    const cancelled = diffs.find((d) => d.changeType === "cancelled");

    expect(added).toBeDefined();
    expect(added?.crn).toBe("9999");
    expect(cancelled).toBeDefined();
    expect(cancelled?.crn).toBe(prev.sections[0].crn);
  });

  it("returns empty diff for identical snapshots", () => {
    const snap = sampleImport();
    const diffs = computeSnapshotDiff(snap, snap);
    expect(diffs).toEqual([]);
  });
});

describe("KFU Monitor Validator", () => {
  it("validates a healthy snapshot exceeding minimum thresholds", () => {
    const healthy = sampleImport();
    const result = validateSnapshotCompleteness(healthy);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe("valid");
    expect(result.failureReason).toBeUndefined();
  });

  it("rejects snapshots below minimum course or section count", () => {
    const tooFewCourses = sampleImport({ courses: sampleImport().courses.slice(0, 10) });
    const result1 = validateSnapshotCompleteness(tooFewCourses);
    expect(result1.isValid).toBe(false);
    expect(result1.failureReason).toContain(`only 10 courses found`);

    const tooFewSections = sampleImport({ sections: sampleImport().sections.slice(0, 50) });
    const result2 = validateSnapshotCompleteness(tooFewSections);
    expect(result2.isValid).toBe(false);
    expect(result2.failureReason).toContain(`only 50 sections found`);
  });

  it("detects severe section count drop (truncation anomaly) and rejects to preserve last-known-good", () => {
    // 400 sections in previous -> 220 sections in current (45% drop, but still above 200 min)
    const prev = sampleImport({
      sections: Array.from({ length: 400 }, (_, i) => ({
        id: `144820:6000${i}`,
        termId: "144820",
        courseId: `144820:COURSE-${(i % 60) + 1}`,
        crn: `6000${i}`,
        sectionCode: `${(i % 5) + 1}`,
        status: "open" as const,
        meetings: [],
        linkedSectionIds: [],
        provenance: {
          sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11",
          importedAt: "2026-11-07T12:00:00.000Z",
          sourceLabel: "KFU",
        },
      })),
    });

    const truncated = sampleImport({
      sections: prev.sections.slice(0, 220),
    });

    const result = validateSnapshotCompleteness(truncated, prev);
    expect(result.isValid).toBe(false);
    expect(result.failureReason).toContain("Suspicious data drop");
  });
});

describe("KFU Freshness Signals", () => {
  it("formats relative time correctly", () => {
    const now = new Date("2026-11-07T12:00:00Z").getTime();
    expect(getRelativeTimeDescription("2026-11-07T11:59:40Z", now)).toBe("Just now");
    expect(getRelativeTimeDescription("2026-11-07T11:30:00Z", now)).toBe("30m ago");
    expect(getRelativeTimeDescription("2026-11-07T08:00:00Z", now)).toBe("4h ago");
    expect(getRelativeTimeDescription("2026-11-05T12:00:00Z", now)).toBe("2d ago");
  });

  it("computes freshness status accurately based on age thresholds", () => {
    const now = new Date("2026-11-07T12:00:00Z").getTime();

    // 30 mins old -> Fresh
    const fresh = computeFreshnessInfo("2026-11-07T11:30:00Z", undefined, undefined, 2, now);
    expect(fresh.isStale).toBe(false);
    expect(fresh.freshnessLabel).toBe("Fresh");

    // 90 mins old -> Aging
    const aging = computeFreshnessInfo("2026-11-07T10:30:00Z", undefined, undefined, 2, now);
    expect(aging.isStale).toBe(false);
    expect(aging.freshnessLabel).toBe("Aging");

    // 3 hours old -> Stale
    const stale = computeFreshnessInfo("2026-11-07T09:00:00Z", undefined, undefined, 2, now);
    expect(stale.isStale).toBe(true);
    expect(stale.freshnessLabel).toBe("Stale");
  });
});

describe("KFU Pipeline Concurrency & Safety Controls", () => {
  it("enforces job locking to prevent concurrent execution on the same dataset", () => {
    const key = "kfu-test-lock";
    expect(acquireJobLock(key)).toBe(true);
    expect(acquireJobLock(key)).toBe(false); // second attempt locked
    releaseJobLock(key);
    expect(acquireJobLock(key)).toBe(true); // unlocked
    releaseJobLock(key);
  });

  it("requires explicit environment approval before automated recurring polling is enabled", () => {
    const original = process.env.KFU_MONITOR_CRON_ENABLED;
    try {
      delete process.env.KFU_MONITOR_CRON_ENABLED;
      expect(isCronExecutionApproved()).toBe(false);

      process.env.KFU_MONITOR_CRON_ENABLED = "true";
      expect(isCronExecutionApproved()).toBe(true);
    } finally {
      process.env.KFU_MONITOR_CRON_ENABLED = original;
    }
  });

  it("preserves previous snapshot when incoming data fails validation", async () => {
    const prev = sampleImport();
    // Simulate invalid incoming HTML that parses with 0 sections
    const badHtml = "<html><body>No course table here</body></html>";

    const result = await executeDatasetRefresh("11", {
      previousSnapshot: prev,
      htmlContent: badHtml,
    });

    expect(result.status).toBe("validation_failed");
    expect(result.snapshotPublished).toBe(false);
    expect(result.preservedPreviousSnapshot).toBe(true);
  });
});
