"use client";

import React from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang } from "../admin-i18n";

interface AuditTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  formatTimestamp: (iso: string) => string;
}

export const AuditTab: React.FC<AuditTabProps> = ({
  data,
  lang,
  formatTimestamp,
}) => {
  const isAr = lang === "ar";
  const { systemInfo, overview, kfuRefresh } = data;

  const realEvents = [
    {
      id: "ev-1",
      type: "DEPLOYMENT",
      title: isAr ? "نشر نسخة الإنتاج الحالية" : "Production Deployment Active",
      source: "Netlify CLI / GitHub",
      timestamp: systemInfo.timestamp,
      severity: "info",
      details: `Deploy ID: ${systemInfo.deployId} · Git Commit: ${systemInfo.commitSha}`,
    },
    {
      id: "ev-2",
      type: "DATASET_PUBLISH",
      title: isAr ? "نشر آخر لقطة لجداول جامعة الملك فيصل" : "KFU Timetable Snapshot Published",
      source: `Worker (${kfuRefresh.refreshSource})`,
      timestamp: overview.lastPublishedAt,
      severity: "success",
      details: `Version: ${overview.activeSnapshotVersion} · ${overview.maleCounts.sections} ♂ / ${overview.femaleCounts.sections} ♀ sections`,
    },
    {
      id: "ev-3",
      type: "WORKER_CHECK",
      title: isAr ? "آخر فحص تشغيلي لعامل التحديث" : "Windows Scheduled Worker Cycle",
      source: "Local Windows Task",
      timestamp: kfuRefresh.lastAttemptedCheck,
      severity: "info",
      details: `${isAr ? "حالة المصدر:" : "Source Health:"} ${overview.sourceHealth}`,
    },
  ];

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "النشاط وسجلات التدقيق" : "Activity Timeline & Audit Trail"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "متابعة الأحداث التشغيلية الحقيقية الموثقة من نشرات الإنتاج وتحديثات الجداول المعتمدة."
              : "Verifiable operational timeline derived from verified deployment metadata and snapshot stores."}
          </p>
        </div>
        <span className="cmd-badge neutral">
          {isAr ? "3 أحداث موثقة حقيقية" : "3 Verified Events"}
        </span>
      </div>

      {/* Honest Empty State for Persistent Audit Storage */}
      <div className="cmd-alert info">
        <span style={{ fontSize: "18px" }}>ℹ️</span>
        <div>
          <strong>
            {isAr ? "سجل التدقيق الدائم (SQL Audit Store) غير متصل" : "Persistent SQL Audit Store Not Attached"}
          </strong>
          <div style={{ marginTop: "4px", fontSize: "13px" }}>
            {isAr
              ? "تعمل المنصة بدون قاعدة بيانات مركزية دائمة لتقليل التعقيد والتكاليف. الأحداث المعروضة أدناه مستخرجة مباشرة من بيانات نشر Netlify ولقطات Blobs الفعلية دون أي تزييف."
              : "LEMON does not maintain a central SQL audit database in order to keep infrastructure zero-cost and lightweight. The events below are sourced directly from verified Netlify deployment markers and Blobs metadata."}
          </div>
        </div>
      </div>

      {/* Verified Events Timeline */}
      <div className="cmd-card" style={{ marginBottom: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            ⏱️ {isAr ? "سجل العمليات التشغيلية الموثقة" : "Verified Operational Events"}
          </h2>
          <span className="cmd-badge success">Live Signals</span>
        </div>

        <div className="cmd-table-wrap">
          <table className="cmd-table">
            <thead>
              <tr>
                <th>{isAr ? "نوع الحدث" : "Event Type"}</th>
                <th>{isAr ? "العنوان والتفاصيل" : "Description & Metadata"}</th>
                <th>{isAr ? "المصدر" : "Source"}</th>
                <th>{isAr ? "التوقيت" : "Timestamp"}</th>
              </tr>
            </thead>
            <tbody>
              {realEvents.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <span className={`cmd-badge ${ev.severity === "success" ? "success" : "neutral"}`}>
                      {ev.type}
                    </span>
                  </td>
                  <td>
                    <strong>{ev.title}</strong>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      <code>{ev.details}</code>
                    </div>
                  </td>
                  <td>{ev.source}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatTimestamp(ev.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proposed Future Audit Architecture */}
      <div className="cmd-card">
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            🏗️ {isAr ? "المخطط المستقبلي لسجل التدقيق الأمني الدائم" : "Proposed Future Audit Log Architecture"}
          </h2>
          <span className="cmd-badge neutral">RFC Specification</span>
        </div>
        <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
          {isAr
            ? "في حال الرغبة مستقبلاً في تسجيل كل محاولة دخول وتغيير في قاعدة بيانات دائمة، يُنصح باعتماد المخطط التالي عبر Netlify Blobs (Audit Append-Only Stream):"
            : "If append-only compliance logging is required in the future, the following privacy-safe schema can be connected to Netlify Blobs without introducing SQL overhead:"}
        </p>

        <div className="cmd-code-box" style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <pre style={{ margin: 0, fontSize: "12px", overflowX: "auto", width: "100%" }}>
{`interface OwnerAuditEvent {
  eventId: string;             // UUID v4
  timestamp: string;           // ISO 8601 UTC
  eventType: "AUTH_SUCCESS" | "AUTH_FAILURE" | "INGEST_PUBLISH" | "ROLLBACK" | "LOGOUT";
  actorEmail: string;          // Verified owner email
  actorSubSha256: string;      // One-way hashed subject ID
  ipHash: string;              // Hashed IP for abuse detection (no raw IP stored)
  userAgent: string;           // Browser client signature
  outcome: "ALLOWED" | "DENIED" | "FAILED";
  metadata?: Record<string, string>; // Strictly sanitized, zero student PII
}`}
          </pre>
        </div>
      </div>
    </div>
  );
};
