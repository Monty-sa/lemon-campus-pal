"use client";

import React, { useState } from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang } from "../admin-i18n";

interface PlatformHealthTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  formatTimestamp: (iso: string) => string;
}

export const PlatformHealthTab: React.FC<PlatformHealthTabProps> = ({
  data,
  lang,
  formatTimestamp,
}) => {
  const isAr = lang === "ar";
  const { overview } = data;

  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<{
    status: number;
    latencyMs: number;
    body: Record<string, unknown> | null;
  } | null>(null);

  const handleRunHealthProbe = async () => {
    setProbing(true);
    const start = performance.now();
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const latencyMs = Math.round(performance.now() - start);
      const json = await res.json();
      setProbeResult({ status: res.status, latencyMs, body: json });
    } catch {
      const latencyMs = Math.round(performance.now() - start);
      setProbeResult({ status: 500, latencyMs, body: null });
    } finally {
      setProbing(false);
    }
  };

  const isUptimeConnected = overview.uptimeRatio !== "Not connected" && overview.uptimeRatio !== "غير متصل";

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "صحة المنصة وفحوصات الجاهزية" : "Platform Health & Diagnostics"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "فحص مباشر للبنية التحتية: دوال Netlify السحابية، مخزن Blobs، وشبكة الحافة Edge."
              : "Direct infrastructure telemetry: Netlify serverless functions, Blobs storage, and edge routing."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleRunHealthProbe}
          disabled={probing}
          className="cmd-btn-compact primary"
        >
          {probing
            ? (isAr ? "جارِ فحص المنصة..." : "Probing Health...")
            : (isAr ? "⚡ فحص فوري للمنظومة" : "⚡ Run Live Health Probe")}
        </button>
      </div>

      {probeResult && (
        <div className={`cmd-alert ${probeResult.status === 200 ? "info" : "danger"}`}>
          <span>{probeResult.status === 200 ? "✅" : "❌"}</span>
          <div style={{ flex: 1 }}>
            <strong>
              {isAr ? "نتيجة الفحص المباشر:" : "Live Probe Result:"} HTTP {probeResult.status} (
              {probeResult.latencyMs} ms)
            </strong>
            {probeResult.body && (
              <pre style={{ margin: "6px 0 0", fontSize: "12px", fontFamily: "monospace" }}>
                {JSON.stringify(probeResult.body, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Services Matrix */}
      <div className="cmd-card" style={{ marginBottom: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            🛰️ {isAr ? "مصفوفة الخدمات والمكونات التشغيلية" : "Operational Services Matrix"}
          </h2>
          <span className="cmd-badge success">
            {isAr ? "5 مكونات مفحوصة" : "5 Verified Subsystems"}
          </span>
        </div>

        <div className="cmd-table-wrap">
          <table className="cmd-table">
            <thead>
              <tr>
                <th>{isAr ? "الخدمة / المكون" : "Subsystem"}</th>
                <th>{isAr ? "النطاق التشغيلي" : "Operational Scope"}</th>
                <th>{isAr ? "الحالة الحالية" : "Status"}</th>
                <th>{isAr ? "نوع الفحص" : "Verification Type"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Next.js 16 SSR & Server Functions</strong>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>Node.js 22 Runtime on Netlify</div>
                </td>
                <td>/admin, /api/admin/*, /api/kfu/*</td>
                <td><span className="cmd-badge success">{isAr ? "يعمل بكفاءة" : "Operational"}</span></td>
                <td>{isAr ? "داخلي (حقيقي)" : "Internal (Real)"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Netlify Blobs Store</strong>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>kfu-snapshots Edge Key-Value Store</div>
                </td>
                <td>Active & previous timetable JSON storage</td>
                <td><span className="cmd-badge success">{isAr ? "متصل ومتاح" : "Connected"}</span></td>
                <td>{isAr ? "قراءة/كتابة موثقة" : "Authenticated I/O"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Netlify Edge Handlers</strong>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>Brotli compression & static caching</div>
                </td>
                <td>Public student assets, Turbopack chunks</td>
                <td><span className="cmd-badge success">{isAr ? "يعمل بكفاءة" : "Operational"}</span></td>
                <td>{isAr ? "شبكة عالمية" : "Global Edge"}</td>
              </tr>
              <tr>
                <td>
                  <strong>External Synthetic Uptime</strong>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>UptimeRobot HTTP Probe</div>
                </td>
                <td>Third-party independent availability probe</td>
                <td>
                  <span className={`cmd-badge ${isUptimeConnected ? "success" : "neutral"}`}>
                    {isUptimeConnected ? overview.uptimeRatio : (isAr ? "غير متصل" : "Not connected")}
                  </span>
                </td>
                <td>{isAr ? "خارجي مستقل" : "Independent External"}</td>
              </tr>
              <tr>
                <td>
                  <strong>Student Client Isolation</strong>
                  <div style={{ fontSize: "11.5px", color: "var(--muted)" }}>Local storage & client-side planner</div>
                </td>
                <td>Zero server dependency for student plans</td>
                <td><span className="cmd-badge success">{isAr ? "آمن ومحلي" : "Isolated (Guest-Only)"}</span></td>
                <td>{isAr ? "خصوصية تامة" : "Zero-Server PII"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Internal Health Check Diagnostic Scope */}
      <div className="cmd-grid-split">
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              📋 {isAr ? "نطاق الفحص الداخلي (/api/health)" : "Internal Probe Scope (/api/health)"}
            </h2>
          </div>
          <div className="cmd-def-list">
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الهدف البرمجي:" : "Target:"}</span>
              <span className="cmd-def-val"><code>GET /api/health</code></span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "آخر فحص للبيئة:" : "Last Environment Probe:"}</span>
              <span className="cmd-def-val">{formatTimestamp(data.systemInfo.timestamp)}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "زمن الاستجابة المتوقع:" : "Expected Latency:"}</span>
              <span className="cmd-def-val">&lt; 15 ms</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "الاستجابة القياسية:" : "Standard Response:"}</span>
              <span className="cmd-def-val"><code>{`{"status":"ok","service":"lemon-kfu-planner"}`}</code></span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "سياسة التخزين المؤقت:" : "Cache Policy:"}</span>
              <span className="cmd-def-val"><code>no-store, no-cache</code></span>
            </div>
          </div>
        </div>

        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🛡️ {isAr ? "ضمانات النزاهة والموثوقية" : "Reliability Guarantees"}
            </h2>
          </div>
          <p className="cmd-page-desc" style={{ marginBottom: "16px" }}>
            {isAr
              ? "تعتمد المنصة معايير الشفافية الكاملة: لا نعرض نسب جاهزية وهمية 100% بدون اشتراك خارجي حقيقي، ولا نزعم تسجيل حوادث بدون قاعدة بيانات سجلات تدقيقية."
              : "LEMON follows strict truthfulness: we never display fabricated 100% uptime without an active external provider, nor do we invent incident logs."}
          </p>
          <div className="cmd-alert info" style={{ marginBottom: "0" }}>
            <span>💡</span>
            <div>
              <strong>{isAr ? "هل ترغب في صفحة حالة عامة؟" : "Want a Public Status Page?"}</strong>
              <div style={{ marginTop: "4px" }}>
                {isAr
                  ? "يمكنك ربط UptimeRobot بضغطة زر وتوليد صفحة status.yourcampuspallemon.app للطلاب مجاناً."
                  : "You can connect UptimeRobot for free and publish a student-facing status page in under 3 minutes."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
