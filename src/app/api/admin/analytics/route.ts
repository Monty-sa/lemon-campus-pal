import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { getAudienceIntelligence } from "@/lib/analytics/engine";
import type { TimeRange } from "@/lib/analytics/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const { searchParams } = new URL(req.url);
    const rangeParam = searchParams.get("range");
    const validRanges: TimeRange[] = ["24h", "7d", "30d", "90d"];
    const range: TimeRange = validRanges.includes(rangeParam as TimeRange)
      ? (rangeParam as TimeRange)
      : "24h";

    const analytics = await getAudienceIntelligence(range);

    return NextResponse.json(analytics, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Internal error compiling audience analytics",
        details: err instanceof Error ? err.message : String(err),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, private",
        },
      },
    );
  }
}
