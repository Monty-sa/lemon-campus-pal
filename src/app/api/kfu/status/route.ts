import { NextResponse } from "next/server";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { KFU_OWNER_ATTESTATION, type KfuRefreshMetadata } from "@/lib/kfu-monitor/types";
import { maleOfferings, femaleOfferings } from "@/data/offerings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = getSnapshotStore();
    const metadata = await store.getMetadata();

    const responseData: KfuRefreshMetadata = {
      lastAttemptedCheck: metadata?.lastAttemptedCheck ?? maleOfferings.importedAt,
      lastSuccessfulFetchMale: metadata?.lastSuccessfulFetchMale ?? maleOfferings.importedAt,
      lastSuccessfulFetchFemale: metadata?.lastSuccessfulFetchFemale ?? femaleOfferings.importedAt,
      lastPublishedMale: metadata?.lastPublishedMale ?? maleOfferings.importedAt,
      lastPublishedFemale: metadata?.lastPublishedFemale ?? femaleOfferings.importedAt,
      lastPublishedSnapshot: metadata?.lastPublishedSnapshot ?? maleOfferings.importedAt,
      maleCourseCount: metadata?.maleCourseCount ?? maleOfferings.courses.length,
      maleSectionCount: metadata?.maleSectionCount ?? maleOfferings.sections.length,
      femaleCourseCount: metadata?.femaleCourseCount ?? femaleOfferings.courses.length,
      femaleSectionCount: metadata?.femaleSectionCount ?? femaleOfferings.sections.length,
      sourceHealth: metadata?.sourceHealth ?? "healthy",
      failureReason: metadata?.failureReason,
      nextExpectedScheduledCheck: metadata?.nextExpectedScheduledCheck,
      refreshSource: metadata?.refreshSource ?? "windows_worker",
      activeVersion: metadata?.activeVersion,
      disclaimer: "Seat availability reflects historical snapshot data and does not guarantee live portal capacity.",
      attestation: KFU_OWNER_ATTESTATION,
    };

    return NextResponse.json(responseData, {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        lastAttemptedCheck: maleOfferings.importedAt,
        sourceHealth: "degraded",
        failureReason: err instanceof Error ? err.message : "Error reading status from durable store",
        disclaimer: "Seat availability reflects historical snapshot data and does not guarantee live portal capacity.",
        attestation: KFU_OWNER_ATTESTATION,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30",
        },
      },
    );
  }
}
