"use client";

import React from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang, I18N } from "../admin-i18n";

interface KfuDataTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  formatTimestamp: (iso: string) => string;
}

export const KfuDataTab: React.FC<KfuDataTabProps> = ({
  data,
  lang,
  formatTimestamp,
}) => {
  const isAr = lang === "ar";
  const t = I18N[lang];
  const { overview, kfuRefresh } = data;

  const maleChanges = kfuRefresh.sectionChangesMale ?? [];
  const femaleChanges = kfuRefresh.sectionChangesFemale ?? [];
  const totalChanges = maleChanges.length + femaleChanges.length;

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "بيانات جامعة الملك فيصل ومراقب Windows" : "KFU Data Pipeline & Windows Worker"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "متابعة شاملة لعمليات جلب ومعالجة ونشر الجداول الدراسية لكلية إدارة الأعمال (الفصل الدراسي 144820)."
              : "End-to-end operational visibility for KFU College of Business Administration timetable pipeline (Term 144820)."}
          </p>
        </div>
        <span className={`cmd-badge ${overview.sourceHealth === "healthy" ? "success" : "warning"}`}>
          {overview.sourceHealth === "healthy" ? (isAr ? "البيانات سليمة" : "Healthy Pipeline") : (isAr ? "تنبيه في البيانات" : "Pipeline Warning")}
        </span>
      </div>

      {/* Operational Security Boundary Alert */}
      <div className="cmd-alert warning" role="note">
        <span style={{ fontSize: "20px" }}>🔒</span>
        <div>
          <strong>{t.boundaryNoticeTitle}</strong>
          <div style={{ marginTop: "4px", fontSize: "13px" }}>{t.boundaryNoticeBody}</div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="cmd-grid-kpi">
        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{isAr ? "نسخة البيانات النشطة" : "Active Snapshot Version"}</span>
            <span className="cmd-badge neutral">Sem 144820</span>
          </div>
          <div className="cmd-stat-value">{overview.activeSnapshotVersion}</div>
          <div className="cmd-stat-sub">
            {isAr ? "تاريخ النشر: " : "Published: "} {formatTimestamp(overview.lastPublishedAt)}
          </div>
        </div>

        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{isAr ? "شعب البنين (♂)" : "Male Sections (♂)"}</span>
            <span className="cmd-badge success">{isAr ? "فئة 11" : "Cat 11"}</span>
          </div>
          <div className="cmd-stat-value">{overview.maleCounts.sections}</div>
          <div className="cmd-stat-sub">
            {overview.maleCounts.courses} {isAr ? "مقرراً معتمداً" : "accredited courses"}
          </div>
        </div>

        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{isAr ? "شعب البنات (♀)" : "Female Sections (♀)"}</span>
            <span className="cmd-badge success">{isAr ? "فئة 12" : "Cat 12"}</span>
          </div>
          <div className="cmd-stat-value">{overview.femaleCounts.sections}</div>
          <div className="cmd-stat-sub">
            {overview.femaleCounts.courses} {isAr ? "مقرراً معتمداً" : "accredited courses"}
          </div>
        </div>

        <div className="cmd-stat-card">
          <div className="cmd-stat-head">
            <span className="cmd-stat-label">{isAr ? "تعديلات الشعب الأخيرة" : "Recent Section Diffs"}</span>
            <span className={`cmd-badge ${totalChanges > 0 ? "warning" : "neutral"}`}>
              {totalChanges > 0 ? `${totalChanges} Diffs` : "0 Changes"}
            </span>
          </div>
          <div className="cmd-stat-value">{totalChanges}</div>
          <div className="cmd-stat-sub">
            {maleChanges.length} ♂ / {femaleChanges.length} ♀ {isAr ? "فروقات مكتشفة" : "detected diffs"}
          </div>
        </div>
      </div>

      {/* Ingestion & Worker Details */}
      <div className="cmd-grid-split">
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              ⚙️ {isAr ? "خصائص ومحددات عامل Windows" : "Windows Worker Specification"}
            </h2>
          </div>
          <div className="cmd-def-list">
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "نمط التنفيذ:" : "Execution Mode:"}</span>
              <span className="cmd-def-val">Local Task Scheduler ({kfuRefresh.refreshSource})</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "طريقة المصادقة:" : "Ingest Authentication:"}</span>
              <span className="cmd-def-val">HMAC-SHA256 (X-KFU-Signature)</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "حماية Nonce Replay:" : "Replay Protection:"}</span>
              <span className="cmd-def-val">5-minute sliding window + nonce claim</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "آخر فحص ناجح للبنين:" : "Last Male Fetch:"}</span>
              <span className="cmd-def-val">
                {kfuRefresh.lastSuccessfulMale ? formatTimestamp(kfuRefresh.lastSuccessfulMale) : "Baseline"}
              </span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "آخر فحص ناجح للبنات:" : "Last Female Fetch:"}</span>
              <span className="cmd-def-val">
                {kfuRefresh.lastSuccessfulFemale ? formatTimestamp(kfuRefresh.lastSuccessfulFemale) : "Baseline"}
              </span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "نبض Better Stack:" : "Heartbeat Monitor:"}</span>
              <span className="cmd-def-val">{kfuRefresh.heartbeatStatus}</span>
            </div>
          </div>
        </div>

        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              ⏱️ {isAr ? "سياسة تقادم وحداثة البيانات" : "Freshness & Staleness Thresholds"}
            </h2>
          </div>
          <p className="cmd-page-desc" style={{ marginBottom: "16px" }}>
            {isAr
              ? "تعتمد المنصة معايير صارمة لتنبيه الطلاب تلقائياً في حال تجاوز عمر البيانات الحدود الطبيعية:"
              : "Automatic threshold banners appear on the student planner if university updates are overdue:"}
          </p>
          <div className="cmd-def-list">
            <div className="cmd-def-row">
              <span className="cmd-def-key">
                <span className="cmd-badge success">{isAr ? "طازجة" : "Fresh"}</span>
                {isAr ? "أقل من 24 ساعة:" : "Under 24 hours:"}
              </span>
              <span className="cmd-def-val" style={{ color: "#15803d" }}>
                {isAr ? "محدثة وطبيعية" : "Optimal (Live badge)"}
              </span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">
                <span className="cmd-badge warning">{isAr ? "تتقادم" : "Aging"}</span>
                {isAr ? "بين 24 و 72 ساعة:" : "24 to 72 hours:"}
              </span>
              <span className="cmd-def-val" style={{ color: "#b45309" }}>
                {isAr ? "تنبيه هادئ في التذييل" : "Subtle timestamp note"}
              </span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">
                <span className="cmd-badge danger">{isAr ? "متقادمة" : "Stale"}</span>
                {isAr ? "أكثر من 72 ساعة:" : "Over 72 hours:"}
              </span>
              <span className="cmd-def-val" style={{ color: "#b91c1c" }}>
                {isAr ? "تنبيه شفاف وصريح للطلاب" : "Transparent disclaimer banner"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Diffs Table */}
      {totalChanges > 0 && (
        <div className="cmd-card" style={{ marginTop: "24px" }}>
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              📝 {isAr ? "سجل فروقات الشعب المكتشفة في آخر تحديث" : "Recent Section Changes from Latest Run"}
            </h2>
            <span className="cmd-badge warning">{totalChanges} Changes</span>
          </div>

          <div className="cmd-table-wrap">
            <table className="cmd-table">
              <thead>
                <tr>
                  <th>CRN</th>
                  <th>{isAr ? "رمز المقرر" : "Course"}</th>
                  <th>{isAr ? "نوع التغيير" : "Change Type"}</th>
                  <th>{isAr ? "الملخص" : "Summary"}</th>
                  <th>{isAr ? "وقت الاكتشاف" : "Detected At"}</th>
                </tr>
              </thead>
              <tbody>
                {[...maleChanges, ...femaleChanges].map((ch, idx) => (
                  <tr key={`${ch.crn}-${idx}`}>
                    <td><code>{ch.crn}</code></td>
                    <td><strong>{ch.courseCode}</strong></td>
                    <td>
                      <span className="cmd-badge warning">{ch.changeType}</span>
                    </td>
                    <td>{ch.summary}</td>
                    <td>{formatTimestamp(ch.detectedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
