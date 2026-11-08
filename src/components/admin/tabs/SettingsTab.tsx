"use client";

import React from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang } from "../admin-i18n";

interface SettingsTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  theme: "system" | "light" | "dark";
  timezoneMode: "riyadh" | "local";
  onSetTheme: (theme: "system" | "light" | "dark") => void;
  onSetLang: (lang: AdminLang) => void;
  onSetTimezoneMode: (mode: "riyadh" | "local") => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  data,
  lang,
  theme,
  timezoneMode,
  onSetTheme,
  onSetLang,
  onSetTimezoneMode,
}) => {
  const isAr = lang === "ar";
  const { systemInfo, security } = data;

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "الإعدادات وتفضيلات مركز التحكم" : "Preferences & System Configuration"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "تخصيص المظهر والنطاق الزمني واللغة، ومراجعة معلومات البيئة التشغيلية المعتمدة."
              : "Customize appearance, timezone display, language, and inspect environment runtime details."}
          </p>
        </div>
        <span className="cmd-badge neutral">
          {isAr ? "تفضيلات محلية مؤمنة" : "Session Scoped"}
        </span>
      </div>

      <div className="cmd-grid-split">
        {/* Appearance & Personalization */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🎨 {isAr ? "المظهر والمؤثرات البصرية" : "Appearance & Theme"}
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                {isAr ? "سمة الواجهة (Theme Mode):" : "Color Theme:"}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["system", "light", "dark"] as const).map((tMode) => (
                  <button
                    key={tMode}
                    type="button"
                    onClick={() => onSetTheme(tMode)}
                    className={`cmd-btn-compact ${theme === tMode ? "primary" : ""}`}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    {tMode === "system" && (isAr ? "💻 نظام الجهاز" : "💻 System")}
                    {tMode === "light" && (isAr ? "☀️ نهاري" : "☀️ Light")}
                    {tMode === "dark" && (isAr ? "🌙 ليلي" : "🌙 Dark")}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "14px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                {isAr ? "لغة مركز التحكم (Language):" : "Command Center Language:"}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => onSetLang("en")}
                  className={`cmd-btn-compact ${lang === "en" ? "primary" : ""}`}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  🇬🇧 English (LTR)
                </button>
                <button
                  type="button"
                  onClick={() => onSetLang("ar")}
                  className={`cmd-btn-compact ${lang === "ar" ? "primary" : ""}`}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  🇸🇦 العربية (RTL)
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "14px" }}>
              <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--ink)", display: "block", marginBottom: "8px" }}>
                {isAr ? "عرض النطاق الزمني للأحداث:" : "Timestamp Display Timezone:"}
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => onSetTimezoneMode("riyadh")}
                  className={`cmd-btn-compact ${timezoneMode === "riyadh" ? "primary" : ""}`}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {isAr ? "🇸🇦 توقيت الرياض (AST · GMT+3)" : "🇸🇦 Asia/Riyadh (AST · GMT+3)"}
                </button>
                <button
                  type="button"
                  onClick={() => onSetTimezoneMode("local")}
                  className={`cmd-btn-compact ${timezoneMode === "local" ? "primary" : ""}`}
                  style={{ flex: 1, justifyContent: "center" }}
                >
                  {isAr ? "📱 توقيت الجهاز المحلي" : "📱 Device Local Time"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* System & Architecture Info */}
        <div className="cmd-card">
          <div className="cmd-card-header">
            <h2 className="cmd-card-title">
              🖥️ {isAr ? "معلومات البيئة التشغيلية (Read-Only)" : "System Environment (Read-Only)"}
            </h2>
          </div>

          <div className="cmd-def-list">
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "إصدار Node.js:" : "Node.js Version:"}</span>
              <span className="cmd-def-val">{systemInfo.nodeVersion}</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "إطار العمل:" : "Framework:"}</span>
              <span className="cmd-def-val">Next.js 16.4.5 (Turbopack)</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "مكتبة React:" : "React Runtime:"}</span>
              <span className="cmd-def-val">React 19.3.1</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "بيئة النشر:" : "Deploy Environment:"}</span>
              <span className="cmd-def-val">Netlify Production</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "مستودع GitHub:" : "GitHub Repository:"}</span>
              <span className="cmd-def-val">Monty-sa/lemon-campus-pal</span>
            </div>
            <div className="cmd-def-row">
              <span className="cmd-def-key">{isAr ? "رابط الـ Callback المعتمد:" : "Authorized Callback:"}</span>
              <span className="cmd-def-val"><code>{security.allowedRedirectOrigin}/api/admin/auth/callback</code></span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Mutation Safety Notice */}
      <div className="cmd-card" style={{ marginTop: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            ⚠️ {isAr ? "مبدأ الأمان للعمليات التعديلية (Mutation Safety)" : "Operational Mutation Safety Policy"}
          </h2>
        </div>
        <p className="cmd-page-desc" style={{ lineHeight: "1.6" }}>
          {isAr
            ? "حرصاً على سلامة واستقرار جداول طلاب جامعة الملك فيصل، لا تحتوي واجهة المالك على أزرار حذف عشوائية أو أوامر تشغيل عن بُعد لحاسوب المالك. أي عملية استرجاع (Rollback) أو تحديث يدوي تتطلب مصادقة HMAC خادمة مشفرة ومراجعة لسجلات التدقيق لمنع أي أخطاء عرضية."
            : "To guarantee 100% stability for student timetables, the Owner Command Center strictly avoids destructive one-click controls or remote worker commands. Any rollback or dataset mutation requires authenticated cryptographic authorization and verified snapshot provenance."}
        </p>
      </div>
    </div>
  );
};
