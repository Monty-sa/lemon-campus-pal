import type { SnapshotFreshnessInfo } from "./types";

export function getRelativeTimeDescription(isoTimestamp: string, now = Date.now(), lang: "ar" | "en" = "en"): string {
  const timestamp = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestamp)) return lang === "ar" ? "غير معروف" : "Unknown";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (lang === "ar") {
    const number = new Intl.NumberFormat("ar-SA");
    if (diffMinutes < 1) return "الآن";
    if (diffMinutes < 60) return `قبل ${number.format(diffMinutes)} دقيقة`;
    if (diffHours < 24) return `قبل ${number.format(diffHours)} ساعة`;
    return `قبل ${number.format(diffDays)} يوم`;
  }
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function computeFreshnessInfo(
  importedAt: string,
  lastCheckedAt?: string,
  lastUpdatedAt?: string,
  maxAgeHours = 2,
  now = Date.now(),
): SnapshotFreshnessInfo {
  const importTime = new Date(importedAt).getTime();
  const ageMs = Math.max(0, now - importTime);
  const ageHours = ageMs / (3600 * 1000);

  const isStale = ageHours > maxAgeHours;
  let freshnessLabel: "Fresh" | "Aging" | "Stale" = "Fresh";

  if (isStale) {
    freshnessLabel = "Stale";
  } else if (ageHours > 1) {
    freshnessLabel = "Aging";
  }

  return {
    importedAt,
    lastCheckedAt,
    lastUpdatedAt,
    isStale,
    freshnessLabel,
    relativeAgeLabel: getRelativeTimeDescription(importedAt, now),
  };
}
