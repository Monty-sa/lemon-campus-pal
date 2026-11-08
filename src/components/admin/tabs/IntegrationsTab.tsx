"use client";

import React, { useState } from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang, I18N } from "../admin-i18n";

interface IntegrationsTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
  data,
  lang,
}) => {
  const isAr = lang === "ar";
  const t = I18N[lang];
  const { overview, errors, kfuRefresh } = data;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const isUptimeConnected = overview.uptimeRatio !== "Not connected" && overview.uptimeRatio !== "غير متصل";
  const isSentryConnected = errors.sentryConfigured && errors.apiConnected;
  const isBetterStackConnected = kfuRefresh.heartbeatStatus !== "Better Stack heartbeat unconfigured" && !kfuRefresh.heartbeatStatus.includes("unconfigured");

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "خدمات الربط والمراقبة الخارجية" : "Integrations & Monitoring Providers"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "دليل الربط الشفاف للأدوات السحابية المعتمدة: رصد التوفر الخارجي، تتبع الأخطاء، ونبض المهام المجدولة."
              : "Honest integration status for external services: synthetic uptime, error tracking, and worker heartbeats."}
          </p>
        </div>
        <span className="cmd-badge neutral">
          {isAr ? "0 خدمات مدفوعة · خطط مجانية بالكامل" : "100% Free-Tier Compatible"}
        </span>
      </div>

      <div className="cmd-alert info">
        <span style={{ fontSize: "18px" }}>💡</span>
        <div>
          <strong>{isAr ? "سياسة النزاهة في عرض الربط" : "Truthful Integration Policy"}</strong>
          <div style={{ marginTop: "4px", fontSize: "13px" }}>
            {isAr
              ? "تُعرض حالة الخدمات أدناه وفقاً لما تم التحقق منه فعلياً. عند عدم ضبط أي خدمة، يُعرض وسم 'غير متصل' مع أسماء المتغيرات المطلوبة فقط دون إظهار أي أسرار."
              : "Provider cards reflect actual verified connectivity. Unconnected services display an explicit 'Not connected' badge with required variable names (no secrets)."}
          </div>
        </div>
      </div>

      {/* 4 Provider Cards Grid */}
      <div className="cmd-grid-split">
        {/* 1. UptimeRobot */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🌐 UptimeRobot
            </h2>
            <span className={`cmd-badge ${isUptimeConnected ? "success" : "neutral"}`}>
              {isUptimeConnected ? t.connected : t.notConnected}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "فحص خارجي مستقل لتوفر الموقع العام كل 5 دقائق مع إمكانية نشر صفحة حالة عامة مجاناً."
              : "Independent external synthetic uptime probe every 5 minutes with free public status page support."}
          </p>

          <div className="cmd-def-list" style={{ marginBottom: "16px" }}>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الحالة التشغيلية:" : "Operational State:"}</span>
              <span className="cmd-def-val">{isUptimeConnected ? overview.uptimeRatio : (isAr ? "غير متصل" : "Not connected")}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "المتغيرات المطلوبة في Netlify:" : "Required Netlify Variables:"}</span>
              <span className="cmd-def-val" style={{ display: "flex", gap: "6px" }}>
                <code>UPTIMEROBOT_API_KEY</code>
                <code>UPTIMEROBOT_MONITOR_ID</code>
              </span>
            </div>
          </div>

          <div className="cmd-code-box">
            <code>UPTIMEROBOT_API_KEY=u123456... UPTIMEROBOT_MONITOR_ID=789...</code>
            <button
              type="button"
              onClick={() => handleCopy("UPTIMEROBOT_API_KEY, UPTIMEROBOT_MONITOR_ID", "uptimerobot")}
              className="cmd-btn-compact"
            >
              {copiedKey === "uptimerobot" ? t.copied : t.copyText}
            </button>
          </div>
        </div>

        {/* 2. Sentry */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🛡️ Sentry Error Monitoring
            </h2>
            <span className={`cmd-badge ${isSentryConnected ? "success" : "neutral"}`}>
              {isSentryConnected ? t.connected : t.notConnected}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "رصد استثناءات الخادم والواجهة عبر Sentry Store API مع حجب بيانات الطلاب الحساسة تماماً."
              : "Captures runtime exceptions via direct HTTP Store API with strict student PII sanitization."}
          </p>

          <div className="cmd-def-list" style={{ marginBottom: "16px" }}>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الحالة التشغيلية:" : "Operational State:"}</span>
              <span className="cmd-def-val">{errors.statusMessage}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "المتغيرات المطلوبة في Netlify:" : "Required Netlify Variables:"}</span>
              <span className="cmd-def-val" style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <code>SENTRY_DSN</code>
                <code>SENTRY_AUTH_TOKEN</code>
                <code>SENTRY_ORG</code>
                <code>SENTRY_PROJECT</code>
              </span>
            </div>
          </div>

          <div className="cmd-code-box">
            <code>SENTRY_DSN=https://... SENTRY_AUTH_TOKEN=sntrys_...</code>
            <button
              type="button"
              onClick={() => handleCopy("SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT", "sentry")}
              className="cmd-btn-compact"
            >
              {copiedKey === "sentry" ? t.copied : t.copyText}
            </button>
          </div>
        </div>

        {/* 3. Better Stack Heartbeat */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              💓 Better Stack (Worker Heartbeat)
            </h2>
            <span className={`cmd-badge ${isBetterStackConnected ? "success" : "neutral"}`}>
              {isBetterStackConnected ? t.connected : t.notConnected}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "مفتاح نبضات الحياة لعامل تحديث الجداول: تنبيه فوري إذا توقف حاسوب المالك عن جلب البيانات."
              : "Dead-man's switch for the local Windows task: alerts if scheduled cycle fails to ping."}
          </p>

          <div className="cmd-def-list" style={{ marginBottom: "16px" }}>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الحالة التشغيلية:" : "Operational State:"}</span>
              <span className="cmd-def-val">{kfuRefresh.heartbeatStatus}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "المتغير المطلوب في حاسوب المالك:" : "Required Worker Variable:"}</span>
              <span className="cmd-def-val"><code>BETTER_STACK_HEARTBEAT_URL</code></span>
            </div>
          </div>

          <div className="cmd-code-box">
            <code>BETTER_STACK_HEARTBEAT_URL=https://uptime.betterstack.com/api/v1/heartbeat/...</code>
            <button
              type="button"
              onClick={() => handleCopy("BETTER_STACK_HEARTBEAT_URL", "betterstack")}
              className="cmd-btn-compact"
            >
              {copiedKey === "betterstack" ? t.copied : t.copyText}
            </button>
          </div>
        </div>

        {/* 4. SpeedVitals / Web Vitals Telemetry */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              ⚡ Web Vitals Telemetry
            </h2>
            <span className="cmd-badge neutral">
              {t.notConnected}
            </span>
          </div>

          <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
            {isAr
              ? "قياس تجربة المستخدم الحقيقية لمؤشرات LCP و INP و CLS دون أي ملفات تعريف ارتباط."
              : "Privacy-first field telemetry for Core Web Vitals with zero third-party cookies."}
          </p>

          <div className="cmd-def-list" style={{ marginBottom: "16px" }}>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الحالة التشغيلية:" : "Operational State:"}</span>
              <span className="cmd-def-val">{isAr ? "معطّل افتراضياً لحماية الخصوصية" : "Disabled by default"}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "المتغير الاختياري:" : "Optional Flag:"}</span>
              <span className="cmd-def-val"><code>NEXT_PUBLIC_ENABLE_WEB_VITALS</code></span>
            </div>
          </div>

          <div className="cmd-code-box">
            <code>NEXT_PUBLIC_ENABLE_WEB_VITALS=true</code>
            <button
              type="button"
              onClick={() => handleCopy("NEXT_PUBLIC_ENABLE_WEB_VITALS", "webvitals")}
              className="cmd-btn-compact"
            >
              {copiedKey === "webvitals" ? t.copied : t.copyText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
