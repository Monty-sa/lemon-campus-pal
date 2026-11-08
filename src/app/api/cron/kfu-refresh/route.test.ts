import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { executeFullPipelineRefresh, isCronExecutionApproved } from "@/lib/kfu-monitor/pipeline";

vi.mock("@/lib/kfu-monitor/pipeline", () => ({
  executeFullPipelineRefresh: vi.fn(),
  isCronExecutionApproved: vi.fn(),
}));

const previousSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
  vi.clearAllMocks();
});

describe("KFU refresh route authorization", () => {
  it("rejects an unconfigured secret before any fetch", async () => {
    delete process.env.CRON_SECRET;
    vi.mocked(isCronExecutionApproved).mockReturnValue(true);

    const response = await POST(new Request("http://localhost/api/cron/kfu-refresh", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(executeFullPipelineRefresh).not.toHaveBeenCalled();
  });

  it("does not let a dry-run header bypass the approval gate", async () => {
    process.env.CRON_SECRET = "test-secret";
    vi.mocked(isCronExecutionApproved).mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/cron/kfu-refresh", {
        method: "POST",
        headers: { authorization: "Bearer test-secret", "x-dry-run": "true" },
      }),
    );

    expect(response.status).toBe(403);
    expect(executeFullPipelineRefresh).not.toHaveBeenCalled();
  });

  it("executes full atomic pipeline when authorized and approved", async () => {
    process.env.CRON_SECRET = "test-secret";
    vi.mocked(isCronExecutionApproved).mockReturnValue(true);
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

    const response = await POST(
      new Request("http://localhost/api/cron/kfu-refresh", {
        method: "POST",
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(executeFullPipelineRefresh).toHaveBeenCalledWith({ dryRun: false });
  });
});
