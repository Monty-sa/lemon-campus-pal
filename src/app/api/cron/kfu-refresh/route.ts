import { NextResponse } from "next/server";
import { executeFullPipelineRefresh, isCronExecutionApproved } from "@/lib/kfu-monitor/pipeline";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCronExecutionApproved()) {
    return NextResponse.json(
      {
        status: "blocked_pending_approval",
        message: "Automated KFU polling is inactive pending explicit operator approval.",
      },
      { status: 403 },
    );
  }

  try {
    const isDryRun = request.headers.get("x-dry-run") === "true";
    const result = await executeFullPipelineRefresh({ dryRun: isDryRun });

    const status =
      result.status === "published" || result.status === "skipped_unchanged"
        ? 200
        : result.status === "locked"
        ? 429
        : 500;

    return NextResponse.json(result, { status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Monitoring execution failed";
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
