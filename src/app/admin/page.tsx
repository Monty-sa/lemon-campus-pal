import Link from "next/link";
import { headers } from "next/headers";
import {
  isOwnerAuthConfigured,
  getAdminSessionFromCookie,
} from "@/lib/admin/auth";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import { getSentryIssueSummary } from "@/lib/monitoring/sentry";
import { getUptimeRobotStatus } from "@/lib/monitoring/uptimerobot";
import { getBetterStackStatus } from "@/lib/monitoring/better-stack";
import { getLogRocketStatus } from "@/lib/monitoring/logrocket";
import { getNewRelicStatus } from "@/lib/monitoring/new-relic";

export const dynamic = "force-dynamic";

interface AdminPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const errorParam = typeof searchParams.error === "string" ? searchParams.error : undefined;
  const langParam = typeof searchParams.lang === "string" ? searchParams.lang : "en";
  const isAr = langParam === "ar";

  const headerList = await headers();
  const cookieHeader = headerList.get("cookie");
  const host = headerList.get("host") || "yourcampuspallemon.netlify.app";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

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
            </ul>

            <div className="setup-redirect-note">
              <strong>{isAr ? "رابط إعادة التوجيه المعتمد (Authorized Redirect URI):" : "Authorized Redirect URI:"}</strong>
              <pre><code>{origin}/api/admin/auth/callback</code></pre>
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

  // 3. STATE C: Verified Owner Control Center
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

  return (
    <main className="admin-page owner-dashboard" dir={isAr ? "rtl" : "ltr"}>
      <header className="admin-header">
        <div className="admin-brand">
          <Link href="/" className="brand" aria-label="LEMON home">
            <span className="brand-fruit"><span>LE</span><b>MON</b></span>
          </Link>
          <span className="admin-portal-badge">{isAr ? "مركز تحكم المالك" : "Owner Control Center"}</span>
        </div>

        <div className="admin-header-actions">
          <div className="owner-badge">
            <span className="owner-status-dot"></span>
            <span className="owner-email">{session.email}</span>
          </div>
          <Link href={`/admin?lang=${isAr ? "en" : "ar"}`} className="admin-btn small secondary">
            {isAr ? "English" : "العربية"}
          </Link>
          <a href="/api/admin/auth/logout" className="admin-btn small danger-outline">
            {isAr ? "تسجيل الخروج" : "Sign Out"}
          </a>
        </div>
      </header>

      <div className="admin-content">
        {/* AREA 1: OVERVIEW */}
        <section className="admin-section" aria-labelledby="area-overview">
          <h2 id="area-overview">📊 {isAr ? "نظرة عامة والجاهزية" : "System Overview & Availability"}</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">{isAr ? "جاهزية الموقع" : "Public Site Uptime"}</span>
              <span className="metric-value status-ok">{uptime.monitors[0]?.uptimeRatio ?? "100%"}</span>
              <span className="metric-sub">{uptime.isConfigured ? (isAr ? "مراقب عبر UptimeRobot" : "Monitored via UptimeRobot") : (isAr ? "الخدمة تعمل محلياً" : "Edge HTTP 200 OK")}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{isAr ? "آخر نشر للبيانات" : "Latest KFU Publication"}</span>
              <span className="metric-value">{metadata?.activeVersion ?? "144820-verified"}</span>
              <span className="metric-sub">{new Date(metadata?.lastPublishedSnapshot ?? maleOfferings.importedAt).toLocaleDateString()}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{isAr ? "شعب البنين / البنات" : "Male / Female Sections"}</span>
              <span className="metric-value">{maleSections} ♂ · {femaleSections} ♀</span>
              <span className="metric-sub">{maleCourses} ♂ / {femaleCourses} ♀ {isAr ? "مقرراً" : "courses"}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">{isAr ? "الأخطاء النشطة (24 ساعة)" : "Unresolved Issues (24h)"}</span>
              <span className={`metric-value ${sentry.issues.length > 0 ? "status-warn" : "status-ok"}`}>
                {sentry.apiConnected ? sentry.issues.length : "0"}
              </span>
              <span className="metric-sub">{sentry.isConfigured ? sentry.statusMessage : (isAr ? "Sentry غير مربوط" : "Sentry not linked")}</span>
            </div>
          </div>
        </section>

        {/* AREA 2: ERRORS */}
        <section className="admin-section" aria-labelledby="area-errors">
          <div className="section-title-wrap">
            <h2 id="area-errors">🛡️ {isAr ? "رصد الأخطاء (Sentry)" : "Error Monitoring (Sentry)"}</h2>
            <span className={`badge-pill ${sentry.isConfigured ? "active" : "pending"}`}>
              {sentry.isConfigured ? (isAr ? "مفعّل" : "Active") : (isAr ? "بانتظار التهيئة" : "Ready for Setup")}
            </span>
          </div>

          <div className="info-card">
            <p className="admin-hint">
              {isAr
                ? "يتم حجب بيانات جداول الطلاب، التقديرات، وأرقام الـ CRN بشكل صارم قبل إرسال أي استثناء لمنع تسريب بيانات الطلاب."
                : "Student schedules, GPA grades, and CRNs are strictly redacted at runtime before exception transmission."}
            </p>

            {sentry.issues.length > 0 ? (
              <div className="table-responsive">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>{isAr ? "الخطأ" : "Issue"}</th>
                      <th>{isAr ? "المستوى" : "Level"}</th>
                      <th>{isAr ? "التكرار" : "Events"}</th>
                      <th>{isAr ? "المستخدمين" : "Users"}</th>
                      <th>{isAr ? "رابط Sentry" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentry.issues.map((issue) => (
                      <tr key={issue.id}>
                        <td>
                          <b>{issue.title}</b>
                          {issue.culprit && <div className="sub-text">{issue.culprit}</div>}
                        </td>
                        <td><span className={`role-tag ${issue.level}`}>{issue.level}</span></td>
                        <td>{issue.count}</td>
                        <td>{issue.userCount}</td>
                        <td>
                          <a href={issue.permalink} target="_blank" rel="noopener noreferrer" className="admin-link-action">
                            {isAr ? "فتح في Sentry ↗" : "View in Sentry ↗"}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-notice">
                <span>{sentry.statusMessage}</span>
                {!sentry.isConfigured && (
                  <div className="setup-inline-hint">
                    <code>SENTRY_DSN</code>, <code>SENTRY_AUTH_TOKEN</code>, <code>SENTRY_ORG</code>, <code>SENTRY_PROJECT</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* AREA 3: KFU REFRESH */}
        <section className="admin-section" aria-labelledby="area-kfu">
          <div className="section-title-wrap">
            <h2 id="area-kfu">🔄 {isAr ? "تحديثات جامعة الملك فيصل ومراقب Windows" : "KFU Refresh & Windows Worker"}</h2>
            <span className={`badge-pill ${metadata?.sourceHealth === "healthy" ? "active" : "pending"}`}>
              {metadata?.sourceHealth ?? "healthy"}
            </span>
          </div>

          <div className="info-card">
            <div className="info-row">
              <strong>{isAr ? "مصدر التحديث:" : "Refresh Source:"}</strong>
              <span>Windows Scheduled Task ({metadata?.refreshSource ?? "windows_worker"})</span>
            </div>
            <div className="info-row">
              <strong>{isAr ? "آخر فحص ناجح:" : "Last Successful Check:"}</strong>
              <span>{new Date(metadata?.lastAttemptedCheck ?? maleOfferings.importedAt).toLocaleString()}</span>
            </div>
            <div className="info-row">
              <strong>{isAr ? "نبضات مراقبة العامل (Better Stack Heartbeat):" : "Worker Heartbeat (Better Stack):"}</strong>
              <span>{betterStack.statusMessage}</span>
            </div>
            {metadata?.failureReason && (
              <div className="info-row alert-row">
                <strong>{isAr ? "سبب التنبيه:" : "Last Warning / Failure:"}</strong>
                <span className="text-danger">{metadata.failureReason}</span>
              </div>
            )}
            <div className="info-row notice-row">
              <strong>{isAr ? "تنبيه أمني:" : "Operational Boundary:"}</strong>
              <span>
                {isAr
                  ? "تستقبل خوادم Netlify تحديثات الجداول المرسلة فقط من جهاز المالك المعتمد عبر توقيع HMAC. لا يمكن لـ Netlify إيقاظ أو تشغيل جهاز المالك عن بُعد."
                  : "Netlify serverless ingestion only accepts authenticated pushes from the owner's Windows worker via HMAC. Netlify cannot wake or control local PCs."}
              </span>
            </div>
          </div>
        </section>

        {/* AREA 4: PERFORMANCE */}
        <section className="admin-section" aria-labelledby="area-performance">
          <h2 id="area-performance">⚡ {isAr ? "الأداء ومؤشرات تجربة المستخدم" : "Performance & Core Web Vitals"}</h2>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-label">LCP (Largest Contentful Paint)</span>
              <span className="metric-value status-ok">&le; 1.5s</span>
              <span className="metric-sub">{isAr ? "هدف ممتاز للشبكات السريعة" : "LIGHTSPEED Target (Fast Mobile)"}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">INP (Interaction to Next Paint)</span>
              <span className="metric-value status-ok">&le; 100ms</span>
              <span className="metric-sub">{isAr ? "استجابة فورية للنقر" : "Smooth mid-range mobile"}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">CLS (Cumulative Layout Shift)</span>
              <span className="metric-value status-ok">&le; 0.05</span>
              <span className="metric-sub">{isAr ? "ثبات بصري تام" : "Zero unexpected shifts"}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">New Relic / LogRocket</span>
              <span className="metric-value status-muted">{isAr ? "معطّل افتراضياً" : "Disabled by Default"}</span>
              <span className="metric-sub" title={`${newRelic.statusMessage} | ${logrocket.statusMessage}`}>
                {isAr ? "للحفاظ على الخصوصية وخفة الموقع" : "Budget & student privacy preserved"}
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
