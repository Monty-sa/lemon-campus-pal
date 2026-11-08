import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminPage from "./page";
import { GET as getAdminMetricsApi } from "../api/admin/metrics/route";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE_NAME } from "@/lib/admin/auth";
import * as nextHeaders from "next/headers";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

describe("LEMON-048A: Owner Control Center & Observability (/admin)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Fail-Closed Behavior When Unconfigured", () => {
    it("renders setup required instructions with sub allowlist when environment variables are missing", async () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      delete process.env.ADMIN_GOOGLE_CLIENT_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_OWNER_EMAILS;
      delete process.env.ADMIN_OWNER_SUBS;

      vi.mocked(nextHeaders.headers).mockResolvedValue(new Headers());

      const jsx = await AdminPage({});
      render(jsx);

      expect(screen.getByText("Setup Required")).toBeInTheDocument();
      expect(screen.getByText("Owner Control Center — Not Configured")).toBeInTheDocument();
      expect(screen.getByText("ADMIN_GOOGLE_CLIENT_ID")).toBeInTheDocument();
      expect(screen.getByText("ADMIN_GOOGLE_CLIENT_SECRET")).toBeInTheDocument();
      expect(screen.getByText("ADMIN_SESSION_SECRET")).toBeInTheDocument();
      expect(screen.getByText("ADMIN_OWNER_EMAILS")).toBeInTheDocument();
      expect(screen.getByText("ADMIN_OWNER_SUBS")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Return to Student Planner" })).toBeInTheDocument();
    });

    it("renders setup instructions in Arabic when lang=ar query parameter is set", async () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      vi.mocked(nextHeaders.headers).mockResolvedValue(new Headers());

      const jsx = await AdminPage({ searchParams: Promise.resolve({ lang: "ar" }) });
      render(jsx);

      expect(screen.getByText("الإعداد مطلوب")).toBeInTheDocument();
      expect(screen.getByText("مركز تحكم المالك — غير مُهيّأ")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "العودة إلى مخطط الجدول" })).toBeInTheDocument();
    });
  });

  describe("Unauthenticated Owner Login Screen", () => {
    beforeEach(() => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "test-client-id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_OWNER_SUBS = "google-sub-12345";
    });

    it("renders Google OAuth sign-in button when no session cookie is present", async () => {
      vi.mocked(nextHeaders.headers).mockResolvedValue(new Headers());

      const jsx = await AdminPage({});
      render(jsx);

      expect(screen.getByText("Owner Authentication")).toBeInTheDocument();
      const loginLink = screen.getByRole("link", { name: /Sign in with Google \(Owner Only\)/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute("href", "/api/admin/auth/login");
    });

    it("displays 403 Forbidden alert when error=access_denied is passed", async () => {
      vi.mocked(nextHeaders.headers).mockResolvedValue(new Headers());

      const jsx = await AdminPage({ searchParams: Promise.resolve({ error: "access_denied" }) });
      render(jsx);

      expect(screen.getByText(/403 Forbidden — Unauthorized Account/)).toBeInTheDocument();
    });

    it("displays invalid state alert when error=invalid_state is passed", async () => {
      vi.mocked(nextHeaders.headers).mockResolvedValue(new Headers());

      const jsx = await AdminPage({ searchParams: Promise.resolve({ error: "invalid_state" }) });
      render(jsx);

      expect(screen.getByText(/Session State Invalid/)).toBeInTheDocument();
    });
  });

  describe("Authenticated Owner Control Center & Truthful Metrics", () => {
    beforeEach(() => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "test-client-id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "test-client-secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_OWNER_SUBS = "google-sub-12345";
    });

    it("renders all four operational areas and truthfully displays Not connected for unconfigured providers", async () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
        name: "Lemon Admin",
      });

      const headers = new Headers();
      headers.set("cookie", `${ADMIN_SESSION_COOKIE_NAME}=${token}`);
      vi.mocked(nextHeaders.headers).mockResolvedValue(headers);

      const jsx = await AdminPage({});
      render(jsx);

      // Header verification
      expect(screen.getByText("Owner Control Center")).toBeInTheDocument();
      expect(screen.getByText("owner@example.com")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Sign Out" })).toHaveAttribute("href", "/api/admin/auth/logout");

      // Area 1: System Overview & Availability — Truthful metrics (no fake 100% or 0)
      expect(screen.getByRole("heading", { name: /System Overview & Availability/i })).toBeInTheDocument();
      expect(screen.getByText("Public Site Uptime")).toBeInTheDocument();
      expect(screen.getByText("Male / Female Sections")).toBeInTheDocument();
      // Unconfigured UptimeRobot & Sentry must show "Not connected"
      const notConnectedBadges = screen.getAllByText("Not connected");
      expect(notConnectedBadges.length).toBeGreaterThanOrEqual(2);

      // Area 2: Error Monitoring (Sentry)
      expect(screen.getByRole("heading", { name: /Error Monitoring \(Sentry\)/i })).toBeInTheDocument();
      expect(screen.getByText(/Student schedules, GPA grades, and CRNs are strictly redacted/)).toBeInTheDocument();

      // Area 3: KFU Refresh & Windows Worker
      expect(screen.getByRole("heading", { name: /KFU Refresh & Windows Worker/i })).toBeInTheDocument();
      expect(screen.getByText("Operational Boundary:")).toBeInTheDocument();
      expect(screen.getByText(/Netlify cannot wake or control local PCs/)).toBeInTheDocument();

      // Area 4: Performance & Core Web Vitals
      expect(screen.getByRole("heading", { name: /Performance & Core Web Vitals/i })).toBeInTheDocument();
      expect(screen.getByText("LCP (Largest Contentful Paint)")).toBeInTheDocument();
      expect(screen.getByText("Disabled by Default")).toBeInTheDocument();
    });

    it("renders authenticated command center in Arabic RTL mode with Saudi translations", async () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });

      const headers = new Headers();
      headers.set("cookie", `${ADMIN_SESSION_COOKIE_NAME}=${token}`);
      vi.mocked(nextHeaders.headers).mockResolvedValue(headers);

      const jsx = await AdminPage({ searchParams: Promise.resolve({ lang: "ar" }) });
      render(jsx);

      expect(screen.getByText("مركز تحكم المالك")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "تسجيل الخروج" })).toBeInTheDocument();
      expect(screen.getByText("جاهزية الموقع")).toBeInTheDocument();
      expect(screen.getByText("شعب البنين / البنات")).toBeInTheDocument();
      expect(screen.getByText(/الحدود الأمنية للعمليات/)).toBeInTheDocument();
    });

    it("renders specific tabs when tab search parameter is supplied", async () => {
      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });

      const headers = new Headers();
      headers.set("cookie", `${ADMIN_SESSION_COOKIE_NAME}=${token}`);
      vi.mocked(nextHeaders.headers).mockResolvedValue(headers);

      // 1. Health Tab
      const healthJsx = await AdminPage({ searchParams: Promise.resolve({ tab: "health" }) });
      const { unmount: unmountHealth } = render(healthJsx);
      expect(screen.getByText(/Platform Health & Diagnostics/i)).toBeInTheDocument();
      expect(screen.getByText(/Operational Services Matrix/i)).toBeInTheDocument();
      unmountHealth();

      // 2. KFU Data Tab
      const kfuJsx = await AdminPage({ searchParams: Promise.resolve({ tab: "kfu" }) });
      const { unmount: unmountKfu } = render(kfuJsx);
      expect(screen.getByText(/KFU Data Pipeline & Windows Worker/i)).toBeInTheDocument();
      expect(screen.getByText(/Freshness & Staleness Thresholds/i)).toBeInTheDocument();
      unmountKfu();

      // 3. Security Tab
      const secJsx = await AdminPage({ searchParams: Promise.resolve({ tab: "security" }) });
      const { unmount: unmountSec } = render(secJsx);
      expect(screen.getByText(/Security Posture & Access Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/Defense-in-Depth Security Checklist/i)).toBeInTheDocument();
      expect(screen.getByText("7/7 Passed")).toBeInTheDocument();
      unmountSec();

      // 4. Integrations Tab
      const intJsx = await AdminPage({ searchParams: Promise.resolve({ tab: "integrations" }) });
      const { unmount: unmountInt } = render(intJsx);
      expect(screen.getByText(/Integrations & Monitoring Providers/i)).toBeInTheDocument();
      expect(screen.getByText(/Truthful Integration Policy/i)).toBeInTheDocument();
      expect(screen.getByText(/100% Free-Tier Compatible/i)).toBeInTheDocument();
      unmountInt();

      // 5. Settings Tab
      const setJsx = await AdminPage({ searchParams: Promise.resolve({ tab: "settings" }) });
      render(setJsx);
      expect(screen.getByText(/Preferences & System Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/Appearance & Theme/i)).toBeInTheDocument();
      expect(screen.getByText(/System Environment \(Read-Only\)/i)).toBeInTheDocument();
    });
  });

  describe("API Route Authorization & Truthful Metrics (/api/admin/metrics)", () => {
    it("returns 503 when owner authentication is unconfigured", async () => {
      delete process.env.ADMIN_GOOGLE_CLIENT_ID;
      const req = new Request("https://lemon.test/api/admin/metrics");
      const res = await getAdminMetricsApi(req);

      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.error).toContain("Owner authentication not configured");
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("returns 401 when request lacks valid owner session cookie", async () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";

      const req = new Request("https://lemon.test/api/admin/metrics");
      const res = await getAdminMetricsApi(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Owner session required");
      expect(res.headers.get("cache-control")).toContain("no-store");
    });

    it("returns 200 with truthful metrics (Not connected for unconfigured monitors)", async () => {
      process.env.ADMIN_GOOGLE_CLIENT_ID = "id";
      process.env.ADMIN_GOOGLE_CLIENT_SECRET = "secret";
      process.env.ADMIN_SESSION_SECRET = "secret-key-at-least-32-bytes-long-here!!";
      process.env.ADMIN_OWNER_EMAILS = "owner@example.com";
      process.env.ADMIN_OWNER_SUBS = "google-sub-12345";
      delete process.env.UPTIMEROBOT_API_KEY;
      delete process.env.SENTRY_AUTH_TOKEN;

      const token = createAdminSessionToken({
        email: "owner@example.com",
        sub: "google-sub-12345",
      });

      const req = new Request("https://lemon.test/api/admin/metrics", {
        headers: {
          cookie: `${ADMIN_SESSION_COOKIE_NAME}=${token}`,
        },
      });

      const res = await getAdminMetricsApi(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.ownerSession.email).toBe("owner@example.com");
      expect(data.overview.maleCounts.sections).toBeGreaterThan(0);
      expect(data.overview.femaleCounts.sections).toBeGreaterThan(0);
      expect(data.overview.uptimeRatio).toBe("Not connected");
      expect(data.overview.unresolvedErrorsCount).toBe("Not connected");
      expect(data.kfuRefresh.refreshSource).toBe("windows_worker");
      expect(data.performance.coreWebVitalsTargets.lcp).toContain("1.5s");
      expect(res.headers.get("cache-control")).toContain("no-store");
    });
  });
});
