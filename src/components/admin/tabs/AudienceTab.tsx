"use client";

import React, { useState } from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang, I18N } from "../admin-i18n";
import type { TimeRange } from "@/lib/analytics/types";

interface AudienceTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  timezoneMode: "riyadh" | "local";
  formatTimestamp: (iso: string) => string;
}

export const AudienceTab: React.FC<AudienceTabProps> = ({
  data,
  lang,
  timezoneMode,
  formatTimestamp,
}) => {
  const isAr = lang === "ar";
  const t = I18N[lang];
  const { audience } = data;

  const [activeRange, setActiveRange] = useState<TimeRange>(audience.summary.timeRange || "24h");
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyEnv = () => {
    navigator.clipboard.writeText("LEMON_ANALYTICS_ENABLED=true");
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const isConfigured = audience.isConfigured;

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "الجمهور وحركة الزوار" : "Audience & Traffic Intelligence"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "متابعة نشاط الطلاب المباشر، أوقات الذروة، إقبال المقررات، ونمو المنصة بخصوصية تامة وبدون كوكيز."
              : "Privacy-first student engagement metrics, live concurrency, peak hours, and platform growth."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Time-range filter pills */}
          <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "8px", padding: "2px" }}>
            {(["24h", "7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setActiveRange(r)}
                className={`cmd-btn-compact ${activeRange === r ? "primary" : ""}`}
                style={{ padding: "4px 10px", fontSize: "11.5px", border: "0" }}
              >
                {r === "24h" && (isAr ? "24 ساعة" : "24h")}
                {r === "7d" && (isAr ? "7 أيام" : "7d")}
                {r === "30d" && (isAr ? "30 يوماً" : "30d")}
                {r === "90d" && (isAr ? "90 يوماً" : "90d")}
              </button>
            ))}
          </div>

          <span className={`cmd-badge ${isConfigured ? "success" : "neutral"}`}>
            {isConfigured ? (isAr ? "التحليلات مفعلة" : "Analytics Active") : (isAr ? "غير مهيّأ" : "Not Configured")}
          </span>
        </div>
      </div>

      {/* Honest Status Alert */}
      {!isConfigured && (
        <div className="cmd-alert info">
          <span style={{ fontSize: "20px" }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <strong>
              {isAr ? "نظام تحليلات الجمهور بانتظار تفعيل المالك" : "Audience Analytics Inactive (Privacy Guaranteed)"}
            </strong>
            <div style={{ marginTop: "4px", fontSize: "13px", lineHeight: "1.5" }}>
              {isAr
                ? "المنصة تعمل حالياً بوضع الخصوصية الصارمة 100% بدون أي نصوص تتبع خارجية أو ملفات تعريف ارتباط (Cookies). لتفعيل القياسات المجهولة وحساب الذروة الحية، اضبط المتغير LEMON_ANALYTICS_ENABLED=true في Netlify."
                : "LEMON currently operates with zero tracking scripts, zero third-party telemetry, and zero cookies. To enable privacy-preserving aggregate metrics and rolling 5-minute concurrency, configure LEMON_ANALYTICS_ENABLED=true in Netlify."}
            </div>
            <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "center" }}>
              <code style={{ background: "var(--surface)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", border: "1px solid var(--line)" }}>
                LEMON_ANALYTICS_ENABLED=true
              </code>
              <button
                type="button"
                onClick={handleCopyEnv}
                className="cmd-btn-compact"
                style={{ padding: "3px 8px", fontSize: "12px" }}
              >
                {copyFeedback ? t.copied : t.copyText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="cmd-grid-kpi">
        {/* Metric 1: Active Visitors Now */}
        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{t.activeVisitorsNow}</span>
            <span className={`cmd-badge ${isConfigured && audience.live.activeVisitorsNow > 0 ? "success" : "neutral"}`}>
              {isConfigured ? (isAr ? "مباشر" : "Live") : t.notConnected}
            </span>
          </div>
          <div className={`cmd-stat-value ${isConfigured && audience.live.activeVisitorsNow > 0 ? "ok" : "muted"}`}>
            {isConfigured ? audience.live.activeVisitorsNow : (isAr ? "غير متصل" : "Not connected")}
          </div>
          <div className="cmd-stat-sub">
            <span className="cmd-pulse-dot" style={{ background: isConfigured ? "#22c55e" : "#9ca3af" }} />
            <span>{isAr ? "نافذة نشاط متحركة لآخر 5 دقائق" : "Rolling 5-min active window"}</span>
          </div>
        </div>

        {/* Metric 2: Peak Concurrent Active Visitors */}
        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{t.peakConcurrent}</span>
            <span className="cmd-badge neutral">
              {timezoneMode === "riyadh" ? "AST (GMT+3)" : (isAr ? "محلي" : "Local")}
            </span>
          </div>
          <div className={`cmd-stat-value ${isConfigured ? "ok" : "muted"}`}>
            {isConfigured ? audience.live.peakConcurrentToday : (isAr ? "بيانات غير كافية" : "Not enough data")}
          </div>
          <div className="cmd-stat-sub">
            {audience.live.peakConcurrentTodayTime
              ? `${isAr ? "سُجلت في: " : "Recorded at: "} ${formatTimestamp(audience.live.peakConcurrentTodayTime)}`
              : (isAr ? "بانتظار تسجيل أول ذروة" : "No recorded concurrency peaks")}
          </div>
        </div>

        {/* Metric 3: Peak Traffic Hour */}
        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{t.peakTrafficHour}</span>
            <span className="cmd-badge neutral">{isAr ? "توقيت الرياض" : "Asia/Riyadh"}</span>
          </div>
          <div className={`cmd-stat-value ${isConfigured && audience.peakHours.length > 0 ? "ok" : "muted"}`}>
            {isConfigured && audience.peakHours.length > 0
              ? audience.peakHours[0].hourLabelRiyadh
              : (isAr ? "غير محدد" : "Unknown")}
          </div>
          <div className="cmd-stat-sub">
            {audience.peakHours.length > 0
              ? `${audience.peakHours[0].sharePercent}% ${isAr ? "من إجمالي حجم الزيارات" : "of total volume"}`
              : (isAr ? "يحسب من بيانات الحركة الفعلية" : "Computed from timestamped traffic")}
          </div>
        </div>

        {/* Metric 4: Unique Students */}
        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{t.uniqueVisitors}</span>
            <span className="cmd-badge neutral">{activeRange}</span>
          </div>
          <div className={`cmd-stat-value ${isConfigured ? "ok" : "muted"}`}>
            {isConfigured ? audience.summary.uniqueVisitors : 0}
          </div>
          <div className="cmd-stat-sub">
            {isConfigured
              ? `${audience.summary.pageViews} ${isAr ? "مشاهدة صفحة" : "page views"} · ${audience.summary.sessions} ${isAr ? "جلسة" : "sessions"}`
              : (isAr ? "بدون تتبع متداخل للطلاب" : "Zero cross-student tracking")}
          </div>
        </div>
      </div>

      {/* Grid Split: Feature Engagement & Top Pages */}
      <div className="cmd-grid-split">
        {/* Anonymous Feature Engagement */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              ⚡ {t.featureUsage}
            </h2>
            <span className="cmd-badge neutral">
              {isAr ? "بدون حفظ CRN أو جداول" : "Zero Student PII"}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "إحصائيات إجمالية مجهولة لاستخدام وظائف الجدول دون تخزين تفاصيل الشعب أو تقديرات الطلاب."
              : "Aggregate anonymous action counts without logging student schedules, selected CRNs, or GPA grades."}
          </p>

          <div className="cmd-table-wrap">
            <table className="cmd-table">
              <thead>
                <tr>
                  <th>{isAr ? "الميزة / التفاعل" : "Feature Interaction"}</th>
                  <th>{isAr ? "العدد الإجمالي" : "Volume"}</th>
                  <th>{isAr ? "نسبة التفاعل" : "Share"}</th>
                </tr>
              </thead>
              <tbody>
                {audience.features.map((feat) => (
                  <tr key={feat.action}>
                    <td>
                      <strong>{isAr ? feat.labelAr : feat.labelEn}</strong>
                    </td>
                    <td>{feat.count}</td>
                    <td>
                      <span className="cmd-badge neutral">{feat.percentage}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Most Visited Pages */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              📄 {isAr ? "الصفحات الأكثر زيارة" : "Most Visited Public Pages"}
            </h2>
            <span className="cmd-badge neutral">Next.js Routes</span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "توزيع الزيارات على مسارات الموقع العامة المستضافة على شبكة Netlify Edge."
              : "Route-level traffic distribution across public pages served via Netlify Edge."}
          </p>

          <div className="cmd-table-wrap">
            <table className="cmd-table">
              <thead>
                <tr>
                  <th>{isAr ? "المسار" : "Route"}</th>
                  <th>{isAr ? "عنوان الصفحة" : "Page Title"}</th>
                  <th>{isAr ? "المشاهدات" : "Views"}</th>
                </tr>
              </thead>
              <tbody>
                {audience.topPages.map((page) => (
                  <tr key={page.path}>
                    <td><code>{page.path}</code></td>
                    <td>{isAr ? page.titleAr : page.titleEn}</td>
                    <td>{page.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Grid Split: Devices & Traffic Sources */}
      <div className="cmd-grid-split">
        {/* Device Breakdown */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              📱 {t.devicesBreakdown}
            </h2>
            <span className="cmd-badge neutral">{isAr ? "بدون بصمة جهاز" : "Zero Fingerprinting"}</span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "تصنيف تقريبي مجرد لنوع الجهاز (جوال / حاسوب / جهاز لوحي) لحساب موازنات الأداء."
              : "Coarse client category without canvas, hardware, or screen fingerprinting."}
          </p>

          <div className="cmd-def-list">
            {audience.devices.map((dev) => (
              <div key={dev.device} className="cmd-def-row">
                <span className="cmd-def-key">
                  {dev.device === "mobile" && "📱 "}
                  {dev.device === "desktop" && "💻 "}
                  {dev.device === "tablet" && "📟 "}
                  {isAr ? dev.labelAr : dev.labelEn}
                </span>
                <span className="cmd-def-val">
                  {dev.count} ({dev.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Traffic Sources / Referrers */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🧭 {t.referrersBreakdown}
            </h2>
            <span className="cmd-badge neutral">{isAr ? "قنوات الطلاب" : "Student Channels"}</span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "القنوات التي يصل منها طلاب الجامعة (تيليجرام، واتساب، بوابة الجامعة، أو بحث مباشر)."
              : "Inbound student channels (Telegram communities, WhatsApp groups, KFU portal, or direct)."}
          </p>

          <div className="cmd-def-list">
            {audience.referrers.map((ref) => (
              <div key={ref.category} className="cmd-def-row">
                <span className="cmd-def-key">
                  {ref.category === "telegram" && "✈️ "}
                  {ref.category === "whatsapp" && "💬 "}
                  {ref.category === "kfu_portal" && "🎓 "}
                  {ref.category === "direct" && "🔖 "}
                  {ref.category === "search" && "🔍 "}
                  {ref.category === "other" && "🌐 "}
                  {isAr ? ref.labelAr : ref.labelEn}
                </span>
                <span className="cmd-def-val">
                  {ref.count} ({ref.percentage}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Traffic Spikes, Drops & Anomaly Alerts */}
      <div className="cmd-card" style={{ marginTop: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            🚨 {isAr ? "تنبيهات طفرات وانخفاضات حركة المرور" : "Traffic Spikes, Abnormal Drops & Incident Alerts"}
          </h2>
          <span className={`cmd-badge ${audience.anomalies.length > 0 ? "warning" : "success"}`}>
            {audience.anomalies.length > 0 ? `${audience.anomalies.length} Alerts` : (isAr ? "الحركة طبيعية" : "Normal Baseline")}
          </span>
        </div>

        {audience.anomalies.length > 0 ? (
          <div className="cmd-alerts-stack">
            {audience.anomalies.map((a) => (
              <div key={a.id} className={`cmd-alert ${a.severity === "spike" ? "warning" : "info"}`}>
                <span>{a.severity === "spike" ? "📈" : "📉"}</span>
                <div>
                  <strong>{isAr ? a.titleAr : a.titleEn}</strong>
                  <div style={{ marginTop: "2px", fontSize: "12.5px" }}>{isAr ? a.descriptionAr : a.descriptionEn}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cmd-def-list">
            <div className="cmd-def-row" style={{ borderBottom: "0" }}>
              <span className="cmd-def-key">
                {isAr
                  ? "لا توجد أي طفرات غير معتادة أو انخفاضات حادة في حركة المرور. المنظومة تراقب فترات التسجيل الرئيسية لجامعة الملك فيصل تلقائياً."
                  : "No abnormal spikes or traffic drops detected. The engine monitors registration rush periods automatically."}
              </span>
              <span className="cmd-def-val" style={{ color: "#15803d" }}>
                {isAr ? "مستقر" : "Stable"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Measurement Methodology & Privacy Attestation */}
      <div className="cmd-card" style={{ marginTop: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            📜 {isAr ? "منهجية القياس وضمانات الخصوصية الصارمة" : "Counting Methodology & Privacy Attestation"}
          </h2>
          <span className="cmd-badge success">Saudi PDPL & GDPR Ready</span>
        </div>

        <div className="cmd-def-list">
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "الزوار المتزامنون (Concurrency):" : "Active Concurrency:"}</span>
            <span className="cmd-def-val" style={{ fontFamily: "inherit" }}>
              {isAr ? "نافذة متحركة لآخر 5 دقائق للمعرفات العشوائية المجهولة (Rolling 5-min window)" : "Rolling 5-minute window of anonymous nonces"}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "تصفية الروبوتات والزواحف:" : "Bot & Crawler Filtering:"}</span>
            <span className="cmd-def-val" style={{ fontFamily: "inherit" }}>
              {isAr ? "استبعاد تلقائي لمحركات البحث وفحوصات الجاهزية من إحصائيات الطلاب" : "Automatic pattern exclusion of search crawlers & uptime probes"}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "عناوين IP والبيانات الشخصية:" : "IP Addresses & Personal Data:"}</span>
            <span className="cmd-def-val" style={{ color: "#15803d", fontFamily: "inherit" }}>
              {isAr ? "عدم تخزين أي عنوان IP نهائياً (Zero raw IP storage)" : "Zero raw IP storage (100% ephemeral hash salt)"}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "بيانات المقررات والمعدل:" : "Timetable & Academic Data:"}</span>
            <span className="cmd-def-val" style={{ color: "#15803d", fontFamily: "inherit" }}>
              {isAr ? "حظر تام لتسجيل جداول الطلاب أو أرقام CRN أو التقديرات" : "Strictly zero schedule, CRN, or GPA grade telemetry"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
