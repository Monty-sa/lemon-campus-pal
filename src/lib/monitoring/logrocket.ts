/**
 * LogRocket Session Diagnostics (LEMON-048)
 *
 * Privacy Guarantees:
 * - Disabled by default (`NEXT_PUBLIC_ENABLE_LOGROCKET=false`).
 * - Zero SDK initialization occurs unless explicit student consent is provided.
 * - If enabled in the future, all input text, timetable data, CRNs, and grades are strictly masked.
 */

export interface LogRocketStatus {
  isEnabled: boolean;
  isConfigured: boolean;
  statusMessage: string;
  privacyNotice: string;
}

export function getLogRocketStatus(): LogRocketStatus {
  const appId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID?.trim();
  const enabledFlag = process.env.NEXT_PUBLIC_ENABLE_LOGROCKET === "true";

  return {
    isEnabled: enabledFlag,
    isConfigured: Boolean(appId),
    statusMessage: enabledFlag
      ? "Active (Behind explicit user consent gate)"
      : "Disabled (Privacy & Performance default — no recording SDK loaded)",
    privacyNotice: "Strict student privacy default: Timetables, CRNs, and GPA grades are masked if ever enabled.",
  };
}
