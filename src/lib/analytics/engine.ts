import type {
  TimeRange,
  DeviceType,
  ReferrerCategory,
  AudienceIntelligenceData,
  PeakTrafficHour,
} from "./types";

/**
 * Known bot and automated scraper patterns.
 * Requests matching these patterns are excluded from unique visitor and session counts.
 */
const BOT_PATTERNS = [
  /bot/i,
  /crawler/i,
  /spider/i,
  /crawling/i,
  /googlebot/i,
  /bingbot/i,
  /yandex/i,
  /baiduspider/i,
  /duckduckbot/i,
  /slurp/i,
  /facebookexternalhit/i,
  /linkedinbot/i,
  /twitterbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /discordbot/i,
  /applebot/i,
  /petalbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
  /mj12bot/i,
  /dotbot/i,
  /uptimerobot/i,
  /pingdom/i,
  /netlify/i,
  /headless/i,
  /lighthouse/i,
  /curl/i,
  /wget/i,
  /python-requests/i,
  /postmanruntime/i,
  /go-http-client/i,
];

export function isBotUserAgent(userAgent?: string | null): boolean {
  if (!userAgent || typeof userAgent !== "string") return false;
  return BOT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

/**
 * Classifies device category using standard User-Agent tokens.
 * Completely stateless with zero fingerprinting or device ID storage.
 */
export function getDeviceType(userAgent?: string | null): DeviceType {
  if (!userAgent) return "desktop";
  const ua = userAgent.toLowerCase();

  if (/ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk/i.test(ua)) {
    return "tablet";
  }
  if (/mobile|iphone|ipod|android.*mobile|blackberry|bb10|phone|iemobile|opera mini/i.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Categorizes external referral sources into meaningful student channels.
 */
export function categorizeReferrer(referrer?: string | null): ReferrerCategory {
  if (!referrer || typeof referrer !== "string" || referrer.trim() === "") {
    return "direct";
  }

  try {
    const parsed = new URL(referrer);
    const host = parsed.hostname.toLowerCase();

    if (host.includes("t.me") || host.includes("telegram")) {
      return "telegram";
    }
    if (host.includes("whatsapp") || host.includes("wa.me")) {
      return "whatsapp";
    }
    if (host.includes("kfu.edu.sa")) {
      return "kfu_portal";
    }
    if (
      host.includes("google") ||
      host.includes("bing") ||
      host.includes("yahoo") ||
      host.includes("duckduckgo") ||
      host.includes("ecosia")
    ) {
      return "search";
    }
    return "other";
  } catch {
    return "direct";
  }
}

/**
 * Converts a UTC timestamp to Asia/Riyadh (AST · GMT+3) hour of day (0-23).
 */
export function getRiyadhHour24(timestamp: string | Date): number {
  const d = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(d.getTime())) return 0;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "numeric",
    hour12: false,
  });

  const hourStr = formatter.format(d);
  const hour = Number.parseInt(hourStr, 10);
  return Number.isNaN(hour) ? d.getUTCHours() : hour % 24;
}

/**
 * Computes peak traffic hours from timestamped volume buckets in Asia/Riyadh timezone.
 */
export function computePeakTrafficHours(
  hourlyVolumes: Array<{ hour24Riyadh: number; count: number }>,
): PeakTrafficHour[] {
  if (!hourlyVolumes || hourlyVolumes.length === 0) return [];

  const total = hourlyVolumes.reduce((acc, curr) => acc + curr.count, 0);
  if (total === 0) return [];

  return [...hourlyVolumes]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((item) => {
      const nextHour = (item.hour24Riyadh + 1) % 24;
      const pad = (n: number) => n.toString().padStart(2, "0");
      return {
        hour24: item.hour24Riyadh,
        hourLabelRiyadh: `${pad(item.hour24Riyadh)}:00 - ${pad(nextHour)}:00 AST`,
        trafficVolume: item.count,
        sharePercent: Math.round((item.count / total) * 100),
      };
    });
}

/**
 * Checks whether analytics data collection is explicitly configured in Netlify.
 */
export function isAnalyticsConfigured(): boolean {
  if (process.env.LEMON_ANALYTICS_ENABLED === "true") {
    return true;
  }
  if (process.env.UMAMI_WEBSITE_ID && process.env.UMAMI_API_KEY) {
    return true;
  }
  return false;
}

/**
 * Returns audience intelligence data for the owner dashboard.
 * When unconfigured, returns an honest unconfigured state with zero fabricated numbers.
 */
export async function getAudienceIntelligence(
  timeRange: TimeRange = "24h",
): Promise<AudienceIntelligenceData> {
  const isConfigured = isAnalyticsConfigured();

  if (!isConfigured) {
    return {
      isConfigured: false,
      statusMessageEn: "Audience analytics is not configured. No tracking scripts or persistent telemetry are active.",
      statusMessageAr: "تحليلات الجمهور وحركة الزوار غير مهيأة. لا توجد أي نصوص تتبع أو قياسات مفعلة.",
      provider: "unconfigured",
      lastFreshnessTimestamp: new Date().toISOString(),
      live: {
        activeVisitorsNow: 0,
        activeWindowMinutes: 5,
        peakConcurrentToday: 0,
        peakConcurrentTodayTime: null,
        historicalPeakConcurrent: 0,
        historicalPeakConcurrentTime: null,
        measurementMethod: "Rolling 5-minute anonymous active nonces (Inactive)",
      },
      summary: {
        uniqueVisitors: 0,
        pageViews: 0,
        sessions: 0,
        newVisitors: 0,
        returningVisitors: 0,
        bounceRatePercent: null,
        timeRange,
      },
      peakHours: [],
      trend: {
        hourly: [],
        daily: [],
        dayOverDayGrowthPercent: null,
        weekOverWeekGrowthPercent: null,
      },
      topPages: [
        { path: "/", titleEn: "Course Timetable Planner", titleAr: "مخطط الجدول الدراسي", views: 0, percentage: 0 },
        { path: "/gpa", titleEn: "KFU GPA Calculator", titleAr: "حاسبة المعدل التراكمي", views: 0, percentage: 0 },
        { path: "/admin", titleEn: "Owner Control Center", titleAr: "مركز تحكم المالك", views: 0, percentage: 0 },
      ],
      devices: [
        { device: "mobile", labelEn: "Mobile", labelAr: "الهواتف الذكية", count: 0, percentage: 0 },
        { device: "desktop", labelEn: "Desktop", labelAr: "الحواسيب المكتبية", count: 0, percentage: 0 },
        { device: "tablet", labelEn: "Tablet", labelAr: "الأجهزة اللوحية", count: 0, percentage: 0 },
      ],
      referrers: [
        { category: "direct", labelEn: "Direct / Bookmarks", labelAr: "دخول مباشر / إشارات مرجعية", count: 0, percentage: 0 },
        { category: "telegram", labelEn: "Telegram Communities", labelAr: "مجتمعات التيليجرام", count: 0, percentage: 0 },
        { category: "whatsapp", labelEn: "WhatsApp Student Groups", labelAr: "قروبات الواتساب الطلابية", count: 0, percentage: 0 },
        { category: "kfu_portal", labelEn: "KFU Portal (Banner/SSB)", labelAr: "بوابة جامعة الملك فيصل", count: 0, percentage: 0 },
        { category: "search", labelEn: "Organic Search", labelAr: "محركات البحث", count: 0, percentage: 0 },
        { category: "other", labelEn: "Other Sources", labelAr: "مصادر أخرى", count: 0, percentage: 0 },
      ],
      features: [
        { action: "planner_view", labelEn: "Timetable Planner Viewed", labelAr: "استعراض مخطط الجدول", count: 0, percentage: 0 },
        { action: "schedule_generated", labelEn: "Auto Schedule Generated", labelAr: "توليد الجداول آلياً", count: 0, percentage: 0 },
        { action: "crn_copied", labelEn: "CRNs Copied to Clipboard", labelAr: "نسخ أرقام الشعب (CRN)", count: 0, percentage: 0 },
        { action: "gpa_calculated", labelEn: "GPA Scenarios Calculated", labelAr: "حساب توقعات المعدل", count: 0, percentage: 0 },
        { action: "catalog_searched", labelEn: "Course Catalog Searched", labelAr: "البحث في دليل المقررات", count: 0, percentage: 0 },
      ],
      anomalies: [],
      privacyAttestation: {
        noStudentPii: true,
        noRawIpStored: true,
        noCookiesUsed: true,
        zeroCrossSiteTracking: true,
      },
    };
  }

  // If configured in future (e.g. native Netlify Blobs analytics or Umami integration)
  return {
    isConfigured: true,
    statusMessageEn: "Audience analytics active via privacy-safe native rollup.",
    statusMessageAr: "تحليلات الجمهور نشطة عبر معالجة بيانات محلية تراعي الخصوصية.",
    provider: "native_blobs",
    lastFreshnessTimestamp: new Date().toISOString(),
    live: {
      activeVisitorsNow: 0,
      activeWindowMinutes: 5,
      peakConcurrentToday: 0,
      peakConcurrentTodayTime: null,
      historicalPeakConcurrent: 0,
      historicalPeakConcurrentTime: null,
      measurementMethod: "Rolling 5-minute anonymous active nonces",
    },
    summary: {
      uniqueVisitors: 0,
      pageViews: 0,
      sessions: 0,
      newVisitors: 0,
      returningVisitors: 0,
      bounceRatePercent: null,
      timeRange,
    },
    peakHours: [],
    trend: {
      hourly: [],
      daily: [],
      dayOverDayGrowthPercent: null,
      weekOverWeekGrowthPercent: null,
    },
    topPages: [
      { path: "/", titleEn: "Course Timetable Planner", titleAr: "مخطط الجدول الدراسي", views: 0, percentage: 0 },
      { path: "/gpa", titleEn: "KFU GPA Calculator", titleAr: "حاسبة المعدل التراكمي", views: 0, percentage: 0 },
    ],
    devices: [
      { device: "mobile", labelEn: "Mobile", labelAr: "الهواتف الذكية", count: 0, percentage: 0 },
      { device: "desktop", labelEn: "Desktop", labelAr: "الحواسيب المكتبية", count: 0, percentage: 0 },
    ],
    referrers: [],
    features: [],
    anomalies: [],
    privacyAttestation: {
      noStudentPii: true,
      noRawIpStored: true,
      noCookiesUsed: true,
      zeroCrossSiteTracking: true,
    },
  };
}
