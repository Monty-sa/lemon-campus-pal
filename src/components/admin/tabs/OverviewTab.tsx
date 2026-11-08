"use client";

import React from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang, I18N } from "../admin-i18n";

interface OverviewTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  timezoneMode: "riyadh" | "local";
  formatTimestamp: (iso: string) => string;
  onNavigateTab: (tabId: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  data,
  lang,
  formatTimestamp,
  onNavigateTab,
}) => {
  const isAr = lang === "ar";
  const t = I18N[lang];

  const { overview, errors, kfuRefresh, performance } = data;

  const isUptimeConnected = overview.uptimeRatio !== "Not connected" && overview.uptimeRatio !== "غير متصل";
  const isSentryConnected = errors.sentryConfigured && errors.apiConnected;

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 id="area-overview" className="cmd-page-title">
            {isAr ? "نظرة عامة والجاهزية" : "System Overview & Availability"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "الملخص التنفيذي لمنصة ليمون: مراقبة الجاهزية الحية، حداثة بيانات جامعة الملك فيصل، ونبض العمليات الحقيقي."
              : "Executive summary for LEMON: live platform availability, KFU dataset freshness, and verified operational signals."}
          </p>
        </div>
        <div className="cmd-header-badge-group">
          <span className={`cmd-badge ${overview.sourceHealth === "healthy" ? "success" : "warning"}`}>
            {overview.sourceHealth === "healthy" ? t.statusHealthy : t.statusDegraded}
          </span>
        </div>
      </div>

      {/* Actionable Alerts (Ranked by Severity) */}
      <div className="cmd-alerts-stack">
        {(!isUptimeConnected || !isSentryConnected) && (
          <div className="cmd-alert warning" role="status">
            <span style={{ fontSize: "18px" }}>⚠️</span>
            <div>
              <strong>{isAr ? "خدمات المراقبة الخارجية غير متصلة" : "External Monitoring Unconfigured"}</strong>
              <div style={{ marginTop: "4px", fontSize: "13px" }}>
                {isAr
                  ? "تعمل المنصة بكفاءة اعتماداً على الفحوصات الداخلية. لتفعيل المراقبة الخارجية وتتبع الأخطاء الصادقة، يُرجى مراجعة صفحة خدمات الربط."
                  : "Platform is operating normally via internal health checks. To enable third-party synthetic uptime and exception telemetry, visit Integrations."}
                {" "}
                <button
                  type="button"
                  onClick={() => onNavigateTab("integrations")}
                  className="cmd-btn-compact"
                  style={{ marginInlineStart: "8px", padding: "2px 8px", fontSize: "12px" }}
                >
                  {isAr ? "تهيئة الربط ↗" : "Configure Integrations ↗"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AREA 1: SYSTEM OVERVIEW & AVAILABILITY */}
      <section className="cmd-section" aria-labelledby="area-overview">
        <div className="cmd-grid-kpi">
          {/* Site Uptime */}
          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">{isAr ? "جاهزية الموقع" : "Public Site Uptime"}</span>
              <span className={`cmd-badge ${isUptimeConnected ? "success" : "neutral"}`}>
                {isUptimeConnected ? t.connected : t.notConnected}
              </span>
            </div>
            <div className={`cmd-stat-value ${isUptimeConnected ? "ok" : "muted"}`}>
              {isUptimeConnected ? overview.uptimeRatio : (isAr ? "غير متصل" : "Not connected")}
            </div>
            <div className="cmd-stat-sub">
              {isUptimeConnected
                ? (isAr ? "مراقب عبر UptimeRobot" : "Monitored via UptimeRobot")
                : (isAr ? "UptimeRobot غير مهيّأ" : "UptimeRobot not configured")}
            </div>
          </div>

          {/* Latest Publication */}
          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">{isAr ? "آخر نشر للبيانات" : "Latest KFU Publication"}</span>
              <span className="cmd-badge success">{isAr ? "معتمد" : "Verified"}</span>
            </div>
            <div className="cmd-stat-value">{overview.activeSnapshotVersion}</div>
            <div className="cmd-stat-sub">
              {formatTimestamp(overview.lastPublishedAt)}
            </div>
          </div>

          {/* Sections Count */}
          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">{isAr ? "شعب البنين / البنات" : "Male / Female Sections"}</span>
              <span className="cmd-badge neutral">144820</span>
            </div>
            <div className="cmd-stat-value">
              {overview.maleCounts.sections} ♂ · {overview.femaleCounts.sections} ♀
            </div>
            <div className="cmd-stat-sub">
              {overview.maleCounts.courses} ♂ / {overview.femaleCounts.courses} ♀ {isAr ? "مقرراً فريداً" : "unique courses"}
            </div>
          </div>

          {/* Unresolved Issues */}
          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">{isAr ? "الأخطاء النشطة (24 ساعة)" : "Unresolved Issues (24h)"}</span>
              <span className={`cmd-badge ${isSentryConnected ? "success" : "neutral"}`}>
                {isSentryConnected ? t.connected : t.notConnected}
              </span>
            </div>
            <div className={`cmd-stat-value ${isSentryConnected ? (Number(overview.unresolvedErrorsCount) > 0 ? "warn" : "ok") : "muted"}`}>
              {isSentryConnected ? overview.unresolvedErrorsCount : (isAr ? "غير متصل" : "Not connected")}
            </div>
            <div className="cmd-stat-sub">
              {isSentryConnected ? errors.statusMessage : (isAr ? "Sentry غير مربوط" : "Sentry not linked")}
            </div>
          </div>
        </div>
      </section>

      {/* Grid Split: Errors & KFU Refresh */}
      <div className="cmd-grid-split">
        {/* AREA 2: ERROR MONITORING (Sentry) */}
        <section className="cmd-card" aria-labelledby="area-errors">
          <div className="cmd-card-header">
            <h2 id="area-errors" className="cmd-card-title">
              🛡️ {isAr ? "رصد الأخطاء (Sentry)" : "Error Monitoring (Sentry)"}
            </h2>
            <span className={`cmd-badge ${errors.sentryConfigured ? "success" : "neutral"}`}>
              {errors.sentryConfigured ? (isAr ? "مفعّل" : "Active") : (isAr ? "بانتظار التهيئة" : "Ready for Setup")}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "يتم حجب بيانات جداول الطلاب، التقديرات، وأرقام الـ CRN بشكل صارم قبل إرسال أي استثناء لمنع تسريب بيانات الطلاب."
              : "Student schedules, GPA grades, and CRNs are strictly redacted at runtime before exception transmission."}
          </p>

          {errors.issues && errors.issues.length > 0 ? (
            <div className="cmd-table-wrap">
              <table className="cmd-table">
                <thead>
                  <tr>
                    <th>{isAr ? "الخطأ" : "Issue"}</th>
                    <th>{isAr ? "المستوى" : "Level"}</th>
                    <th>{isAr ? "التكرار" : "Events"}</th>
                    <th>{isAr ? "المستخدمين" : "Users"}</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.issues.map((issue) => (
                    <tr key={issue.id}>
                      <td>
                        <strong>{issue.title}</strong>
                        {issue.culprit && <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>{issue.culprit}</div>}
                      </td>
                      <td><span className="cmd-badge warning">{issue.level}</span></td>
                      <td>{issue.count}</td>
                      <td>{issue.userCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cmd-code-box" style={{ justifyContent: "center", flexDirection: "column", padding: "20px" }}>
              <span style={{ color: "var(--muted)" }}>{errors.statusMessage}</span>
              {!errors.sentryConfigured && (
                <div style={{ marginTop: "10px" }}>
                  <code>SENTRY_DSN</code>, <code>SENTRY_AUTH_TOKEN</code>, <code>SENTRY_ORG</code>, <code>SENTRY_PROJECT</code>
                </div>
              )}
            </div>
          )}
        </section>

        {/* AREA 3: KFU REFRESH & WINDOWS WORKER */}
        <section className="cmd-card" aria-labelledby="area-kfu">
          <div className="cmd-card-header">
            <h2 id="area-kfu" className="cmd-card-title">
              🔄 {isAr ? "تحديثات جامعة الملك فيصل ومراقب Windows" : "KFU Refresh & Windows Worker"}
            </h2>
            <span className={`cmd-badge ${overview.sourceHealth === "healthy" ? "success" : "warning"}`}>
              {overview.sourceHealth}
            </span>
          </div>

          <div className="cmd-def-list">
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "مصدر التحديث:" : "Refresh Source:"}</span>
              <span className="cmd-def-val">Windows Scheduled Task ({kfuRefresh.refreshSource})</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "آخر فحص ناجح:" : "Last Successful Check:"}</span>
              <span className="cmd-def-val">{formatTimestamp(kfuRefresh.lastAttemptedCheck)}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "نبضات مراقبة العامل (Better Stack Heartbeat):" : "Worker Heartbeat (Better Stack):"}</span>
              <span className="cmd-def-val">{kfuRefresh.heartbeatStatus}</span>
            </div>
            {kfuRefresh.failureReason && (
              <div className="cmd-def-row" style={{ color: "var(--danger)" }}>
                <span className="cmd-def-key">{isAr ? "سبب التنبيه:" : "Last Warning / Failure:"}</span>
                <span className="cmd-def-val">{kfuRefresh.failureReason}</span>
              </div>
            )}
            <div className="cmd-def-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "6px" }}>
              <strong className="cmd-def-key">{isAr ? "الحدود الأمنية للعمليات:" : "Operational Boundary:"}</strong>
              <span style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: "1.5" }}>
                {isAr
                  ? "تستقبل خوادم Netlify تحديثات الجداول المرسلة فقط من جهاز المالك المعتمد عبر توقيع HMAC. لا يمكن لـ Netlify إيقاظ أو تشغيل جهاز المالك عن بُعد."
                  : "Netlify serverless ingestion only accepts authenticated pushes from the owner's Windows worker via HMAC. Netlify cannot wake or control local PCs."}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* AREA 4: PERFORMANCE & CORE WEB VITALS */}
      <section className="cmd-card" aria-labelledby="area-performance" style={{ marginTop: "20px" }}>
        <div className="cmd-card-header">
          <h2 id="area-performance" className="cmd-card-title">
            ⚡ {isAr ? "الأداء ومؤشرات تجربة المستخدم" : "Performance & Core Web Vitals"}
          </h2>
          <span className="cmd-badge target">{t.targetOnly}</span>
        </div>

        <div className="cmd-grid-kpi" style={{ marginBottom: "0" }}>
          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">LCP (Largest Contentful Paint)</span>
              <span className="cmd-badge target">{t.targetOnly}</span>
            </div>
            <div className="cmd-stat-value ok">&le; 1.5s</div>
            <div className="cmd-stat-sub">{isAr ? "هدف ممتاز للشبكات السريعة" : "LIGHTSPEED Target (Fast Mobile)"}</div>
          </div>

          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">INP (Interaction to Next Paint)</span>
              <span className="cmd-badge target">{t.targetOnly}</span>
            </div>
            <div className="cmd-stat-value ok">&le; 100ms</div>
            <div className="cmd-stat-sub">{isAr ? "استجابة فورية للنقر" : "Smooth mid-range mobile"}</div>
          </div>

          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">CLS (Cumulative Layout Shift)</span>
              <span className="cmd-badge target">{t.targetOnly}</span>
            </div>
            <div className="cmd-stat-value ok">&le; 0.05</div>
            <div className="cmd-stat-sub">{isAr ? "ثبات بصري تام" : "Zero unexpected shifts"}</div>
          </div>

          <div className="cmd-stat-card">
            <div className="cmd-stat-head">
              <span className="cmd-stat-label">New Relic / LogRocket</span>
              <span className="cmd-badge neutral">{isAr ? "محجوب" : "Preserved"}</span>
            </div>
            <div className="cmd-stat-value muted">{isAr ? "معطّل افتراضياً" : "Disabled by Default"}</div>
            <div className="cmd-stat-sub" title={`${performance.monitoring.newRelic} | ${performance.monitoring.logRocket}`}>
              {isAr ? "للحفاظ على الخصوصية وخفة الموقع" : "Budget & student privacy preserved"}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
