import type { SnapshotFreshnessInfo } from "./types";

export function getRelativeTimeDescription(isoTimestamp: string, now = Date.now()): string {
  const timestamp = new Date(isoTimestamp).getTime();
  if (Number.isNaN(timestamp)) return "Unknown";

  const diffMs = Math.max(0, now - timestamp);
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

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
