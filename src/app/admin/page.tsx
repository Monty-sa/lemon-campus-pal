import Link from "next/link";
import { headers } from "next/headers";
import {
  isOwnerAuthConfigured,
  getAdminSessionFromCookie,
  getTrustedRedirectOrigin,
  getOwnerAllowlist,
} from "@/lib/admin/auth";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import { getSentryIssueSummary } from "@/lib/monitoring/sentry";
import { getUptimeRobotStatus } from "@/lib/monitoring/uptimerobot";
import { getBetterStackStatus } from "@/lib/monitoring/better-stack";
import { getLogRocketStatus } from "@/lib/monitoring/logrocket";
import { getNewRelicStatus } from "@/lib/monitoring/new-relic";
import { getAudienceIntelligence } from "@/lib/analytics/engine";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";
import type { AdminDashboardData } from "@/components/admin/types";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const errorParam = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const langParam = typeof searchParams.lang === "string" ? searchParams.lang : "en";
  const tabParam = typeof searchParams.tab === "string" ? searchParams.tab : "overview";
  const isAr = langParam === "ar";

  const headerList = await headers();
  const cookieHeader = headerList.get("cookie");

  // 1. STATE A: Configuration Missing (Fail Closed)
  if (!isOwnerAuthConfigured()) {
    return (
      <main className="admin-page" dir={isAr ? "rtl" : "ltr"}>
        <div className="admin-card setup-required-card" role="alert">
          <div className="status-badge warning">{isAr ? "الإعداد مطلوب" : "Setup Required"}</div>
          <h1>{isAr ? "مركز تحكم المالك — غير مُهيّأ" : "Owner Control Center — Not Configured"}</h1>
          <p className="admin-subtitle">
            {isAr
              ? "الدخول محظور أمنياً بشكل افتراضي (Fail-closed). يجب على مالك المشروع تهيئة متغيرات مصادقة Google OAuth في Netlify للوصول إلى لوحة التحكم."
              : "Access is strictly blocked by default (Fail-closed). The project owner must configure Google OAuth environment variables in Netlify to access this dashboard."}
          </p>

          <div className="setup-steps-box">
            <h3>{isAr ? "المتغيرات المطلوبة في Netlify:" : "Required Netlify Environment Variables:"}</h3>
            <ul className="env-var-list">
              <li>
                <code>ADMIN_GOOGLE_CLIENT_ID</code>
                <span>{isAr ? "معرف عميل Google OAuth 2.0 من Google Cloud Console" : "Google OAuth 2.0 Web Client ID from Google Cloud Console"}</span>
              </li>
              <li>
                <code>ADMIN_GOOGLE_CLIENT_SECRET</code>
                <span>{isAr ? "المفتاح السري لعميل Google OAuth 2.0" : "Google OAuth 2.0 Client Secret"}</span>
              </li>
              <li>
                <code>ADMIN_SESSION_SECRET</code>
                <span>{isAr ? "سلسلة تشفير سرية عشوائية لا تقل عن 32 حرفاً لتوقيع الجلسات" : "Cryptographically secure random secret (min 32 chars) for HMAC signing"}</span>
              </li>
              <li>
                <code>ADMIN_OWNER_EMAILS</code>
                <span>{isAr ? "قائمة بريد إلكتروني مفصولة بفواصل لحسابات المالك المعتمدة فقط" : "Comma-separated allowlist of verified owner Google email addresses"}</span>
              </li>
              <li>
                <code>ADMIN_OWNER_SUBS</code>
                <span>{isAr ? "معرفات Google Subject (sub) الثابتة للمالكين لربط الهوية بأمان تام" : "Allowlist of verified Google Subject (sub) IDs for immutable owner identity binding"}</span>
              </li>
            </ul>

            <div className="setup-redirect-note">
              <strong>{isAr ? "رابط إعادة التوجيه المعتمد (Authorized Redirect URI):" : "Authorized Redirect URI:"}</strong>
              <pre><code>{getTrustedRedirectOrigin()}/api/admin/auth/callback</code></pre>
            </div>
          </div>

          <div className="admin-actions">
            <Link href="/" className="admin-btn secondary">
              {isAr ? "العودة إلى مخطط الجدول" : "Return to Student Planner"}
            </Link>
            <Link href={`/admin?lang=${isAr ? "en" : "ar"}`} className="admin-btn text-link">
              {isAr ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 2. STATE B: Unauthenticated Owner
  const session = getAdminSessionFromCookie(cookieHeader);

  if (!session) {
    return (
      <main className="admin-page" dir={isAr ? "rtl" : "ltr"}>
        <div className="admin-card login-card">
          <div className="admin-brand-header">
            <Link href="/" className="brand" aria-label="LEMON home">
              <span className="brand-fruit"><span>LE</span><b>MON</b></span>
            </Link>
            <span className="admin-portal-badge">{isAr ? "مركز تحكم المالك" : "Owner Control Center"}</span>
          </div>

          <h1>{isAr ? "تسجيل دخول المالك" : "Owner Authentication"}</h1>
          <p className="admin-subtitle">
            {isAr
              ? "هذه اللوحة مخصصة لإدارة العمليات ومراقبة جاهزية النظام، ومحمية بحسابات المالك المعتمدة فقط."
              : "Restricted owner portal for operational metrics and monitoring. Public student planning remains guest-only."}
          </p>

          {errorParam === "access_denied" && (
            <div className="admin-alert danger" role="alert">
              <strong>{isAr ? "403 محظور — الحساب غير مصرح له" : "403 Forbidden — Unauthorized Account"}</strong>
              <p>
                {isAr
                  ? "حساب Google الذي تم تسجيل الدخول به ليس ضمن قائمة المالكين المعتمدة (ADMIN_OWNER_EMAILS)."
                  : "The Google identity used is not configured in the verified owner allowlist (ADMIN_OWNER_EMAILS)."}
              </p>
            </div>
          )}

          {errorParam === "invalid_state" && (
            <div className="admin-alert warning" role="alert">
              <strong>{isAr ? "خطأ في التحقق من الجلسة" : "Session State Invalid"}</strong>
              <p>{isAr ? "انتهت صلاحية رمز الأمان أو تم حظر ملفات الارتباط. يُرجى المحاولة مرة أخرى." : "CSRF security state token expired or invalid. Please retry."}</p>
            </div>
          )}

          {errorParam === "google_denied" && (
            <div className="admin-alert warning" role="alert">
              <strong>{isAr ? "تم إلغاء المصادقة" : "Google Sign-In Cancelled"}</strong>
              <p>{isAr ? "تم إلغاء تسجيل الدخول عبر Google." : "Authentication was cancelled or declined."}</p>
            </div>
          )}

          <div className="login-actions">
            <a href="/api/admin/auth/login" className="admin-btn google-oauth-btn">
              <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isAr ? "تسجيل الدخول عبر Google (للمالك فقط)" : "Sign in with Google (Owner Only)"}</span>
            </a>
          </div>

          <div className="login-footer">
            <Link href="/" className="admin-btn text-link">
              {isAr ? "العودة إلى الموقع" : "Return to Planner"}
            </Link>
            <Link href={`/admin?lang=${isAr ? "en" : "ar"}`} className="admin-btn text-link">
              {isAr ? "English" : "العربية"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // 3. STATE C: Verified Owner Command Center
  const store = getSnapshotStore();
  const [metadata, sentry, uptime, changesMale, changesFemale, audience] = await Promise.all([
    store.getMetadata(),
    getSentryIssueSummary(),
    getUptimeRobotStatus(),
    store.getSectionChanges("11"),
    store.getSectionChanges("12"),
    getAudienceIntelligence("24h"),
  ]);

  const betterStack = getBetterStackStatus();
  const logrocket = getLogRocketStatus();
  const newRelic = getNewRelicStatus();

  const maleSections = metadata?.maleSectionCount ?? maleOfferings.sections.length;
  const femaleSections = metadata?.femaleSectionCount ?? femaleOfferings.sections.length;
  const maleCourses = metadata?.maleCourseCount ?? maleOfferings.courses.length;
  const femaleCourses = metadata?.femaleCourseCount ?? femaleOfferings.courses.length;

  const dashboardData: AdminDashboardData = {
    ownerSession: {
      email: session.email,
      sub: session.sub,
      name: session.name,
      picture: session.picture,
      iat: session.iat,
      exp: session.exp,
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
      sectionChangesMale: changesMale.map((c) => ({
        crn: c.crn,
        courseCode: c.courseCode,
        changeType: c.changeType,
        summary: c.summary,
        detectedAt: c.detectedAt,
      })),
      sectionChangesFemale: changesFemale.map((c) => ({
        crn: c.crn,
        courseCode: c.courseCode,
        changeType: c.changeType,
        summary: c.summary,
        detectedAt: c.detectedAt,
      })),
    },
    performance: {
      coreWebVitalsTargets: {
        lcp: "<= 1.5s (Good)",
        inp: "<= 100ms (Good)",
        cls: "<= 0.05 (Good)",
      },
      monitoring: {
        uptimeRobot: uptime.statusMessage,
        newRelic: newRelic.statusMessage,
        logRocket: logrocket.statusMessage,
      },
    },
    security: {
      googleAuthVerified: true,
      allowedRedirectOrigin: getTrustedRedirectOrigin(),
      cookieSettings: "HttpOnly; SameSite=Lax; Secure; Max-Age=86400",
      isOwnerSubsConfigured: Boolean(process.env.ADMIN_OWNER_SUBS),
      ownerEmailsCount: getOwnerAllowlist().length,
    },
    audience,
    systemInfo: {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? "production",
      deployId: process.env.DEPLOY_ID ?? "6af0d11f8e705c8310134c80",
      commitSha: process.env.COMMIT_REF ?? "696f5d6",
      timestamp: new Date().toISOString(),
    },
  };

  return (
    <AdminCommandCenter
      initialData={dashboardData}
      initialTab={tabParam}
      initialLang={isAr ? "ar" : "en"}
    />
  );
}
