import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../../../netlify/functions/kfu-monitor";
import { executeFullPipelineRefresh } from "@/lib/kfu-monitor/pipeline";

vi.mock("@/lib/kfu-monitor/pipeline", () => ({
  executeFullPipelineRefresh: vi.fn(),
  isCronExecutionApproved: vi.fn(() => process.env.KFU_MONITOR_CRON_ENABLED === "true"),
}));

describe("Netlify Scheduled Function (kfu-monitor)", () => {
  const originalEnv = process.env.KFU_MONITOR_CRON_ENABLED;

  beforeEach(() => {
    delete process.env.KFU_MONITOR_CRON_ENABLED;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.KFU_MONITOR_CRON_ENABLED = originalEnv;
    } else {
      delete process.env.KFU_MONITOR_CRON_ENABLED;
    }
  });

  it("blocks execution when KFU_MONITOR_CRON_ENABLED is not set", async () => {
    const res = await handler();
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("blocked_pending_approval");
    expect(executeFullPipelineRefresh).not.toHaveBeenCalled();
  });

  it("executes full atomic pipeline when approved by environment flag", async () => {
    process.env.KFU_MONITOR_CRON_ENABLED = "true";
    vi.mocked(executeFullPipelineRefresh).mockResolvedValue({
      status: "published",
      executedAt: "2026-11-08T12:00:00.000Z",
      male: {
        target: {
          termId: "144820",
          collegeCode: "06",
          categoryCode: "11",
          categoryLabelEn: "Male",
          categoryLabelAr: "طلاب",
          url: "",
        },
        status: "success",
        changesCount: 0,
        changes: [],
        snapshotPublished: true,
        preservedPreviousSnapshot: false,
        warnings: [],
      },
      female: {
        target: {
          termId: "144820",
          collegeCode: "06",
          categoryCode: "12",
          categoryLabelEn: "Female",
          categoryLabelAr: "طالبات",
          url: "",
        },
        status: "success",
        changesCount: 0,
        changes: [],
        snapshotPublished: true,
        preservedPreviousSnapshot: false,
        warnings: [],
      },
    });

    const res = await handler();
    expect(res.statusCode).toBe(200);
    expect(executeFullPipelineRefresh).toHaveBeenCalledTimes(1);
    const body = JSON.parse(res.body);
    expect(body.executedAt).toBeDefined();
    expect(body.status).toBe("published");
  });
});
