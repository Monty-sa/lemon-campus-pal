import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isBotUserAgent,
  getDeviceType,
  categorizeReferrer,
  getRiyadhHour24,
  computePeakTrafficHours,
  isAnalyticsConfigured,
  getAudienceIntelligence,
} from "./engine";
import { GET as getAdminAnalyticsApi } from "@/app/api/admin/analytics/route";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin/auth";

describe("LEMON-049A: Audience & Traffic Intelligence Engine", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("1. Bot & Scraper Detection", () => {
    it("identifies automated crawlers, uptime monitors, and headless probes as bots", () => {
      const bots = [
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
        "YandexBot/3.0 (+http://yandex.com/bots)",
        "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
        "UptimeRobot/2.0 (http://www.uptimerobot.com/)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36 Netlify/1.0",
        "curl/8.4.0",
        "python-requests/2.31.0",
        "PostmanRuntime/7.36.0",
      ];

      for (const ua of bots) {
        expect(isBotUserAgent(ua)).toBe(true);
      }
    });

    it("identifies legitimate student browser User-Agents as human", () => {
      const humans = [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.119 Mobile Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
      ];

      for (const ua of humans) {
        expect(isBotUserAgent(ua)).toBe(false);
      }
      expect(isBotUserAgent(null)).toBe(false);
      expect(isBotUserAgent("")).toBe(false);
    });
  });

  describe("2. Privacy-Safe Device Classification", () => {
    it("classifies mobile, tablet, and desktop without fingerprinting", () => {
      // Mobile
      expect(getDeviceType("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("mobile");
      expect(getDeviceType("Mozilla/5.0 (Linux; Android 14; SM-A536B) Mobile Safari/537.36")).toBe("mobile");

      // Tablet
      expect(getDeviceType("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBe("tablet");
      expect(getDeviceType("Mozilla/5.0 (Linux; Android 13; SM-X800) AppleWebKit/537.36 Safari/537.36")).toBe("tablet");

      // Desktop
      expect(getDeviceType("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36")).toBe("desktop");
      expect(getDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15")).toBe("desktop");
      expect(getDeviceType(null)).toBe("desktop");
    });
  });

  describe("3. Student Inbound Referral Categorization", () => {
    it("categorizes Telegram, WhatsApp, KFU Portal, and Search referrals accurately", () => {
      expect(categorizeReferrer("https://t.me/kfu_students")).toBe("telegram");
      expect(categorizeReferrer("https://telegram.me/colleges")).toBe("telegram");
      expect(categorizeReferrer("https://chat.whatsapp.com/invite123")).toBe("whatsapp");
      expect(categorizeReferrer("https://wa.me/966500000000")).toBe("whatsapp");
      expect(categorizeReferrer("https://ssb-ar.kfu.edu.sa/PROD_ar/twbkwbis.P_GenMenu")).toBe("kfu_portal");
      expect(categorizeReferrer("https://www.google.com.sa/search?q=lemon+kfu")).toBe("search");
      expect(categorizeReferrer("https://www.bing.com/search?q=kfu")).toBe("search");
      expect(categorizeReferrer(null)).toBe("direct");
      expect(categorizeReferrer("")).toBe("direct");
      expect(categorizeReferrer("https://random-blog.com/post")).toBe("other");
    });
  });

  describe("4. Asia/Riyadh (AST) Peak Hour Calculation", () => {
    it("converts UTC timestamps to Asia/Riyadh AST hours correctly", () => {
      // 09:00 UTC is 12:00 in Asia/Riyadh (UTC+3)
      const hour = getRiyadhHour24("2026-11-08T09:30:00Z");
      expect(hour).toBe(12);

      // 22:00 UTC is 01:00 the next day in Asia/Riyadh
      const hourLate = getRiyadhHour24("2026-11-08T22:15:00Z");
      expect(hourLate).toBe(1);
    });

    it("computes peak traffic hours sorted by volume with share percentage", () => {
      const volumes = [
        { hour24Riyadh: 10, count: 50 },
        { hour24Riyadh: 14, count: 200 }, // Peak 1
        { hour24Riyadh: 20, count: 150 }, // Peak 2
        { hour24Riyadh: 3, count: 10 },
      ];

      const peaks = computePeakTrafficHours(volumes);
      expect(peaks.length).toBe(3);
      expect(peaks[0].hour24).toBe(14);
      expect(peaks[0].hourLabelRiyadh).toContain("14:00 - 15:00 AST");
      expect(peaks[0].trafficVolume).toBe(200);
      expect(peaks[0].sharePercent).toBe(49); // 200 / 410 = ~48.78% -> 49%

      expect(peaks[1].hour24).toBe(20);
      expect(peaks[1].trafficVolume).toBe(150);
    });

    it("handles empty or zero-volume hourly buckets safely", () => {
      expect(computePeakTrafficHours([])).toEqual([]);
      expect(computePeakTrafficHours([{ hour24Riyadh: 12, count: 0 }])).toEqual([]);
    });
  });

  describe("5. Truthful Unconfigured State Handling", () => {
    it("reports isConfigured: false and zero data when LEMON_ANALYTICS_ENABLED is not set", async () => {
      delete process.env.LEMON_ANALYTICS_ENABLED;
      delete process.env.UMAMI_WEBSITE_ID;

      expect(isAnalyticsConfigured()).toBe(false);

      const data = await getAudienceIntelligence("24h");
      expect(data.isConfigured).toBe(false);
      expect(data.provider).toBe("unconfigured");
      expect(data.live.activeVisitorsNow).toBe(0);
      expect(data.live.measurementMethod).toContain("Inactive");
      expect(data.summary.uniqueVisitors).toBe(0);
      expect(data.privacyAttestation.noStudentPii).toBe(true);
      expect(data.privacyAttestation.noRawIpStored).toBe(true);
    });
  });

  describe("6. Protected Admin Analytics API Route (/api/admin/analytics)", () => {
    it("returns 503 when owner authentication is unconfigured", async () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      const req = new Request("https://lemon.test/api/admin/analytics");
      const res = await getAdminAnalyticsApi(req);

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("Owner authentication not configured");
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("returns 401 when request lacks valid owner session cookie", async () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "test-id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";

      const req = new Request("https://lemon.test/api/admin/analytics");
      const res = await getAdminAnalyticsApi(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Owner session required");
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("returns 200 with audience intelligence when authorized", async () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "test-id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "test-secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_OWNER_SUBS = "google-sub-12345";

      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });

      const req = new Request("https://lemon.test/api/admin/analytics?range=7d", {
        headers: {
          cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getAdminAnalyticsApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.summary.timeRange).toBe("7d");
      expect(data.privacyAttestation.noStudentPii).toBe(true);
      expect(res.headers.get("cache-control")).toContain("no-store");
      expect(res.headers.get("cache-control")).toContain("private");
    });
  });
});
