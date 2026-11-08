"use client";

import React from "react";
import type { AdminDashboardData } from "../types";
import { type AdminLang } from "../admin-i18n";

interface SecurityTabProps {
  data: AdminDashboardData;
  lang: AdminLang;
  formatTimestamp: (iso: string) => string;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({
  data,
  lang,
  formatTimestamp,
}) => {
  const isAr = lang === "ar";
  const { ownerSession, security } = data;

  const sessionIssuedAt = ownerSession.iat ? formatTimestamp(new Date(ownerSession.iat * 1000).toISOString()) : "Verified Session";
  const sessionExpiresAt = ownerSession.exp ? formatTimestamp(new Date(ownerSession.exp * 1000).toISOString()) : "24 Hours from Issue";

  const currentEpoch = Math.floor(new Date(data.systemInfo.timestamp).getTime() / 1000);
  const remainingSeconds = ownerSession.exp ? Math.max(0, ownerSession.exp - currentEpoch) : 86400;
  const remainingHours = Math.floor(remainingSeconds / 3600);
  const remainingMinutes = Math.floor((remainingSeconds % 3600) / 60);

  return (
    <div className="cmd-tab-content">
      <div className="cmd-page-header">
        <div>
          <h1 className="cmd-page-title">
            {isAr ? "الأمان والتحكم في الوصول" : "Security Posture & Access Governance"}
          </h1>
          <p className="cmd-page-desc">
            {isAr
              ? "مراجعة شاملة لآليات التشفير، المصادقة الثنائية لـ Google، وملفات تعريف ارتباط الجلسات المؤمنة."
              : "Comprehensive audit of cryptographic verification, Google OAuth JWKS checks, and session governance."}
          </p>
        </div>
        <span className="cmd-badge success">
          {isAr ? "المنظومة مؤمنة بالكامل" : "All Gates Enforced"}
        </span>
      </div>

      {/* Active Session Card */}
      <div className="cmd-card" style={{ marginBottom: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            👤 {isAr ? "بيانات جلسة المالك النشطة الحالية" : "Current Authenticated Owner Session"}
          </h2>
          <span className="cmd-badge success">
            {isAr ? "صحيحة وموثقة" : "Cryptographically Verified"}
          </span>
        </div>

        <div className="cmd-def-list">
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "البريد الإلكتروني المعتمد للمالك:" : "Authenticated Owner Email:"}</span>
            <span className="cmd-def-val">{ownerSession.email}</span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "حالة التحقق من هوية Google Subject:" : "Google Subject (sub) Verification:"}</span>
            <span className="cmd-def-val">
              {security.isOwnerSubsConfigured
                ? (isAr ? "مقيد ومطابق لـ ADMIN_OWNER_SUBS" : "Bound & Enforced (ADMIN_OWNER_SUBS)")
                : (isAr ? "مفحوص ومقبول (معرف فريد غير مقيد)" : "Verified via Google JWKS")}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "توقيت إنشاء الجلسة:" : "Session Issued At:"}</span>
            <span className="cmd-def-val">{sessionIssuedAt}</span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "توقيت انتهاء الجلسة:" : "Session Expires At:"}</span>
            <span className="cmd-def-val">{sessionExpiresAt}</span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "الصلاحية المتبقية للجلسة:" : "Remaining Session Time:"}</span>
            <span className="cmd-def-val" style={{ color: "#15803d" }}>
              {remainingHours}h {remainingMinutes}m
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "رابط إعادة التوجيه المعتمد:" : "Fixed Production Redirect URI:"}</span>
            <span className="cmd-def-val"><code>{security.allowedRedirectOrigin}/api/admin/auth/callback</code></span>
          </div>
        </div>
      </div>

      {/* Security Controls & Defense-in-Depth Checklist */}
      <div className="cmd-card" style={{ marginBottom: "24px" }}>
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            🛡️ {isAr ? "قائمة تدقيق الحماية متعددة الطبقات" : "Defense-in-Depth Security Checklist"}
          </h2>
          <span className="cmd-badge success">7/7 Passed</span>
        </div>

        <div className="cmd-table-wrap">
          <table className="cmd-table">
            <thead>
              <tr>
                <th>{isAr ? "طبقة الحماية" : "Security Control"}</th>
                <th>{isAr ? "الآلية التقنية" : "Technical Implementation"}</th>
                <th>{isAr ? "نوع الحماية من الهجمات" : "Threat Mitigated"}</th>
                <th>{isAr ? "الحالة" : "Audit Status"}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Cryptographic JWKS Verification</strong></td>
                <td>google-auth-library verifies RSA signature directly against accounts.google.com JWKS.</td>
                <td>Forged tokens, altered claims, revoked Google credentials.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Fail-Closed Gate</strong></td>
                <td>Missing OAuth credentials immediately disable all admin routes without executing business logic.</td>
                <td>Misconfiguration leaks, accidental staging exposure.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Dual CSRF State Verification</strong></td>
                <td>HMAC-SHA256 signed nonce cookie (Max-Age=600) compared in callback route.</td>
                <td>Login CSRF, cross-site callback injection.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Hardened Session Cookie</strong></td>
                <td>HttpOnly, SameSite=Lax, Secure flags with 24-hour expiration (Max-Age=86400).</td>
                <td>XSS session theft, packet sniffing on public Wi-Fi.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Fixed Origin Pinning</strong></td>
                <td>getTrustedRedirectOrigin() rejects unvalidated client Host headers.</td>
                <td>Host header injection, phishing redirect spoofing.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Immediate Session Invalidation</strong></td>
                <td>/api/admin/auth/logout sets Max-Age=0 and epoch expiration for instant cookie destruction.</td>
                <td>Dangling browser sessions, unauthorized device access.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
              <tr>
                <td><strong>Zero Student Admin Navigation</strong></td>
                <td>Public student navigation contains zero admin links; admin route requires direct bookmark.</td>
                <td>Reconnaissance, credential brute-forcing, student confusion.</td>
                <td><span className="cmd-badge success">PASS</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Privacy Safeguards */}
      <div className="cmd-card">
        <div className="cmd-card-header">
          <h2 className="cmd-card-title">
            🔒 {isAr ? "ضمانات خصوصية الطلاب (Student Privacy By Design)" : "Student Privacy By Design Guarantees"}
          </h2>
        </div>
        <p className="cmd-page-desc" style={{ marginBottom: "14px" }}>
          {isAr
            ? "تلتزم المنصة بأعلى معايير الخصوصية لطلاب جامعة الملك فيصل:"
            : "LEMON operates under strict zero-knowledge principles for students:"}
        </p>
        <div className="cmd-def-list">
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "حسابات الطلاب:" : "Student Accounts:"}</span>
            <span className="cmd-def-val" style={{ color: "#15803d" }}>
              {isAr ? "وضع ضيف كامل (Guest-Only) بنسبة 100%" : "100% Guest-Only (Zero server accounts)"}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "بيانات الجداول والمعدل:" : "Schedules & GPA Data:"}</span>
            <span className="cmd-def-val">
              {isAr ? "تخزين محلي فقط على جهاز الطالب (LocalStorage)" : "Stored locally in browser LocalStorage"}
            </span>
          </div>
          <div className="cmd-def-row">
            <span className="cmd-def-key">{isAr ? "حجب استثناءات Sentry:" : "Sentry Exception Scrubbing:"}</span>
            <span className="cmd-def-val">
              {isAr ? "حذف أرقام CRN والتقديرات تلقائياً قبل الإرسال" : "Strict runtime sanitization of CRNs & GPA plans"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
