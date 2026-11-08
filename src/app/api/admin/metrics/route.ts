import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/lib/admin/auth";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import { getSentryIssueSummary } from "@/lib/monitoring/sentry";
import { getUptimeRobotStatus } from "@/lib/monitoring/uptimerobot";
import { getBetterStackStatus } from "@/lib/monitoring/better-stack";
import { getLogRocketStatus } from "@/lib/monitoring/logrocket";
import { getNewRelicStatus } from "@/lib/monitoring/new-relic";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyAdminRequest(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  try {
    const store = getSnapshotStore();
    const metadata = await store.getMetadata();

    const [sentry, uptime] = await Promise.all([
      getSentryIssueSummary(),
      getUptimeRobotStatus(),
    ]);

    const betterStack = getBetterStackStatus();
    const logrocket = getLogRocketStatus();
    const newRelic = getNewRelicStatus();

    const maleSections = metadata?.maleSectionCount ?? maleOfferings.sections.length;
    const femaleSections = metadata?.femaleSectionCount ?? femaleOfferings.sections.length;
    const maleCourses = metadata?.maleCourseCount ?? maleOfferings.courses.length;
    const femaleCourses = metadata?.femaleCourseCount ?? femaleOfferings.courses.length;

    const metricsData = {
      ownerSession: {
        email: auth.session.email,
        name: auth.session.name,
      },
      overview: {
        siteStatus: uptime.isConfigured && uptime.monitors[0] ? uptime.monitors[0].status : "Not connected",
        uptimeRatio: uptime.isConfigured && uptime.monitors[0] ? uptime.monitors[0].uptimeRatio : "Not connected",
        sourceHealth: metadata?.sourceHealth ?? "healthy",
        lastPublishedAt: metadata?.lastPublishedSnapshot ?? maleOfferings.importedAt,
        activeSnapshotVersion: metadata?.activeVersion ?? "144820-verified",
        maleCounts: { courses: maleCourses, sections: maleSections },
        femaleCounts: { courses: femaleCourses, sections: femaleSections },
        unresolvedErrorsCount: sentry.isConfigured && sentry.apiConnected ? sentry.issues.length : "Not connected",
      },
      errors: {
        sentryConfigured: sentry.isConfigured,
        apiConnected: sentry.apiConnected,
        statusMessage: sentry.statusMessage,
        issues: sentry.issues,
      },
      kfuRefresh: {
        refreshSource: metadata?.refreshSource ?? "windows_worker",
        lastAttemptedCheck: metadata?.lastAttemptedCheck ?? maleOfferings.importedAt,
        lastSuccessfulMale: metadata?.lastSuccessfulFetchMale ?? maleOfferings.importedAt,
        lastSuccessfulFemale: metadata?.lastSuccessfulFetchFemale ?? femaleOfferings.importedAt,
        failureReason: metadata?.failureReason ?? null,
        heartbeatStatus: betterStack.statusMessage,
        workerNotice: "Netlify serverless ingestion receives publications pushed from the local Windows worker. Netlify does not wake or poll local PCs.",
      },
      performance: {
        coreWebVitalsTargets: {
          lcp: "<= 1.5s (Good)",
          fid: "<= 100ms (Good)",
          cls: "<= 0.05 (Good)",
        },
        monitoring: {
          uptimeRobot: uptime.statusMessage,
          newRelic: newRelic.statusMessage,
          logRocket: logrocket.statusMessage,
        },
      },
    };

    return NextResponse.json(metricsData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "Internal error compiling operational metrics",
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
