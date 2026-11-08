export type TimeRange = "24h" | "7d" | "30d" | "90d";

export type DeviceType = "mobile" | "desktop" | "tablet";

export type ReferrerCategory =
  | "direct"
  | "telegram"
  | "whatsapp"
  | "kfu_portal"
  | "search"
  | "other";

export type AnonymousFeatureAction =
  | "planner_view"
  | "schedule_generated"
  | "crn_copied"
  | "gpa_calculated"
  | "catalog_searched"
  | "guide_viewed"
  | "academic_dates_viewed";

export interface LiveAudienceStats {
  activeVisitorsNow: number;
  activeWindowMinutes: number;
  peakConcurrentToday: number;
  peakConcurrentTodayTime: string | null;
  historicalPeakConcurrent: number;
  historicalPeakConcurrentTime: string | null;
  measurementMethod: string;
}

export interface TrafficSummary {
  uniqueVisitors: number;
  pageViews: number;
  sessions: number;
  newVisitors: number;
  returningVisitors: number;
  bounceRatePercent: number | null;
  timeRange: TimeRange;
}

export interface PeakTrafficHour {
  hour24: number; // 0 - 23 in Asia/Riyadh
  hourLabelRiyadh: string; // e.g. "14:00 - 15:00 AST"
  trafficVolume: number;
  sharePercent: number;
}

export interface HourlyTrafficPoint {
  timestamp: string; // ISO 8601
  hourLabel: string;
  visitors: number;
  pageViews: number;
}

export interface DailyTrafficPoint {
  date: string; // YYYY-MM-DD
  dayLabel: string;
  uniques: number;
  pageViews: number;
  sessions: number;
}

export interface TopPageStat {
  path: string;
  titleEn: string;
  titleAr: string;
  views: number;
  percentage: number;
}

export interface DeviceBreakdown {
  device: DeviceType;
  labelEn: string;
  labelAr: string;
  count: number;
  percentage: number;
}

export interface ReferrerBreakdown {
  category: ReferrerCategory;
  labelEn: string;
  labelAr: string;
  count: number;
  percentage: number;
}

export interface FeatureEngagementStat {
  action: AnonymousFeatureAction;
  labelEn: string;
  labelAr: string;
  count: number;
  percentage: number;
}

export interface TrafficAnomalyAlert {
  id: string;
  severity: "info" | "warning" | "spike";
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  detectedAt: string;
}

export interface AudienceIntelligenceData {
  isConfigured: boolean;
  statusMessageEn: string;
  statusMessageAr: string;
  provider: "native_blobs" | "umami" | "cloudflare" | "unconfigured";
  lastFreshnessTimestamp: string;
  live: LiveAudienceStats;
  summary: TrafficSummary;
  peakHours: PeakTrafficHour[];
  trend: {
    hourly: HourlyTrafficPoint[];
    daily: DailyTrafficPoint[];
    dayOverDayGrowthPercent: number | null;
    weekOverWeekGrowthPercent: number | null;
  };
  topPages: TopPageStat[];
  devices: DeviceBreakdown[];
  referrers: ReferrerBreakdown[];
  features: FeatureEngagementStat[];
  anomalies: TrafficAnomalyAlert[];
  privacyAttestation: {
    noStudentPii: boolean;
    noRawIpStored: boolean;
    noCookiesUsed: boolean;
    zeroCrossSiteTracking: boolean;
  };
}
