import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scrubSensitiveData, captureException, getSentryIssueSummary, parseSentryDsn } from "./sentry";
import { getUptimeRobotStatus } from "./uptimerobot";
import { getBetterStackStatus, sendBetterStackHeartbeat } from "./better-stack";
import { getLogRocketStatus } from "./logrocket";
import { getNewRelicStatus } from "./new-relic";
import { GET as getHealthApi } from "@/app/api/health/route";

describe("LEMON-048A: Monitoring Integrations & Privacy Guarantees", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Sentry Privacy & Genuine Delivery", () => {
    it("redacts student plans, CRNs, courses, and GPA grades from error contexts", () => {
      const rawContext = {
        component: "WeeklyCalendar",
        plans: [{ id: "plan-1", name: "Primary Schedule", sections: [101, 102] }],
        crns: ["10101", "10202"],
        grades: [{ courseCode: "ACCT101", grade: "A+" }],
        gpa: 4.85,
        cookie: "session=xyz123",
        authorization: "Bearer secret-token",
        safeMeta: "render-failed",
      };

      const scrubbed = scrubSensitiveData(rawContext);

      expect(scrubbed.plans).toBe("[REDACTED]");
      expect(scrubbed.crns).toBe("[REDACTED]");
      expect(scrubbed.grades).toBe("[REDACTED]");
      expect(scrubbed.gpa).toBe("[REDACTED]");
      expect(scrubbed.cookie).toBe("[REDACTED]");
      expect(scrubbed.authorization).toBe("[REDACTED]");
      expect(scrubbed.safeMeta).toBe("render-failed");
      expect(scrubbed.component).toBe("WeeklyCalendar");
    });

    it("parses valid and invalid Sentry DSN formats", () => {
      const parsed = parseSentryDsn("https://myPublicKey@o12345.ingest.sentry.io/4507890");
      expect(parsed).not.toBeNull();
      expect(parsed?.publicKey).toBe("myPublicKey");
      expect(parsed?.host).toBe("o12345.ingest.sentry.io");
      expect(parsed?.projectId).toBe("4507890");

      expect(parseSentryDsn("invalid-dsn")).toBeNull();
    });

    it("explicitly returns inactive status when SENTRY_DSN is not configured", async () => {
      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const result = await captureException(new Error("Test error"));
      expect(result.delivered).toBe(false);
      expect(result.status).toBe("inactive");
    });

    it("delivers genuine privacy-safe event payload to Sentry Store API when configured", async () => {
      process.env.SENTRY_DSN = "https://testkey@o9999.ingest.sentry.io/123456";

      const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal("fetch", mockFetch);

      const result = await captureException(new Error("Database connection timeout"), {
        component: "SnapshotStore",
        plans: [{ id: "secret-plan" }],
        retryCount: 2,
      });

      expect(result.delivered).toBe(true);
      expect(result.status).toBe("delivered");
      expect(result.eventId).toBeTruthy();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://o9999.ingest.sentry.io/api/123456/store/",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-Sentry-Auth": expect.stringContaining("sentry_key=testkey"),
          }),
        }),
      );

      // Verify payload body has scrubbed data
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.exception.values[0].value).toBe("Database connection timeout");
      expect(sentBody.extra.plans).toBe("[REDACTED]");
      expect(sentBody.extra.retryCount).toBe(2);

      vi.unstubAllGlobals();
    });

    it("reports Setup Required when SENTRY_DSN is absent and never invents fake counts", async () => {
      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;

      const summary = await getSentryIssueSummary();
      expect(summary.isConfigured).toBe(false);
      expect(summary.statusMessage).toContain("Setup Required: SENTRY_DSN is not configured");
      expect(summary.issues).toHaveLength(0);
    });
  });

  describe("UptimeRobot Public Availability & Truthfulness", () => {
    it("provides safe public health endpoint (/api/health) with no-store headers", async () => {
      const res = await getHealthApi();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("lemon-kfu-planner");
      expect(data.timestamp).toBeTruthy();
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("reports Ready for Setup without claiming 100% uptime when API key is missing", async () => {
      delete process.env.UPTIMEROBOT_API_KEY;

      const status = await getUptimeRobotStatus();
      expect(status.isConfigured).toBe(false);
      expect(status.statusMessage).toContain("Ready for Setup");
      expect(status.monitors).toHaveLength(0);
      expect(status.recommendedConfig.targetUrl).toContain("/api/health");
      expect(status.recommendedConfig.intervalMinutes).toBe(5);
    });
  });

  describe("Better Stack Heartbeat in Windows Worker", () => {
    it("reports heartbeat status based on BETTER_STACK_HEARTBEAT_URL", () => {
      delete process.env.BETTER_STACK_HEARTBEAT_URL;
      const unconf = getBetterStackStatus();
      expect(unconf.isConfigured).toBe(false);
      expect(unconf.statusMessage).toContain("Ready for Setup");

      process.env.BETTER_STACK_HEARTBEAT_URL = "https://uptime.betterstack.com/api/v1/heartbeat/test-token";
      const conf = getBetterStackStatus();
      expect(conf.isConfigured).toBe(true);
      expect(conf.heartbeatConfigured).toBe(true);
      expect(conf.statusMessage).toContain("Active");
    });

    it("sends success ping to heartbeat URL and fail ping to /fail endpoint", async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", mockFetch);

      const heartbeatUrl = "https://uptime.betterstack.com/api/v1/heartbeat/mytoken";

      // Success ping
      const ok1 = await sendBetterStackHeartbeat(heartbeatUrl, "success", "Published 450 sections");
      expect(ok1).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        heartbeatUrl,
        expect.objectContaining({ method: "POST", body: "Published 450 sections" }),
      );

      // Failure ping
      const ok2 = await sendBetterStackHeartbeat(heartbeatUrl, "fail", "KFU fetch timed out");
      expect(ok2).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${heartbeatUrl}/fail`,
        expect.objectContaining({ method: "POST", body: "KFU fetch timed out" }),
      );

      vi.unstubAllGlobals();
    });
  });

  describe("LogRocket & New Relic Safety Defaults", () => {
    it("LogRocket is disabled by default to protect student privacy and avoid bundle overhead", () => {
      delete process.env.NEXT_PUBLIC_ENABLE_LOGROCKET;
      delete process.env.NEXT_PUBLIC_LOGROCKET_APP_ID;

      const lr = getLogRocketStatus();
      expect(lr.isEnabled).toBe(false);
      expect(lr.statusMessage).toContain("Disabled (Privacy & Performance default");
    });

    it("New Relic browser agent is disabled by default to maintain LIGHTSPEED budget", () => {
      delete process.env.NEW_RELIC_LICENSE_KEY;
      delete process.env.NEW_RELIC_APP_ID;

      const nr = getNewRelicStatus();
      expect(nr.isConfigured).toBe(false);
      expect(nr.statusMessage).toContain("Disabled / Ready for Setup");
    });
  });
});
