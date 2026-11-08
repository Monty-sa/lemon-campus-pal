import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminPage from "./page";
import { GET as getAdminMetricsApi } from "../api/admin/metrics/route";
import * as serverLib from "@/lib/cloud/server";
import * as adminLib from "@/lib/cloud/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/cloud/server");
vi.mock("@/lib/cloud/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof adminLib>();
  return {
    ...actual,
    isAdminUser: vi.fn(),
    getAdminPrivilegedSupabase: vi.fn(),
    getAdminMetrics: vi.fn(),
    getAdminUsersList: vi.fn(),
  };
});

describe("Admin Authorization & Dashboard (LEMON-010F)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access on /admin page", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as unknown as SupabaseClient;

    vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);

    const jsx = await AdminPage();
    render(jsx);

    expect(screen.getByText("401 Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("Authentication Required")).toBeInTheDocument();
    expect(screen.queryByText("System Overview & Metrics")).not.toBeInTheDocument();
  });

  it("denies authenticated non-admin access on /admin page", async () => {
    const mockUser = { id: "non-admin-user-uuid", email: "student@example.com" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    } as unknown as SupabaseClient;

    vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);
    vi.mocked(adminLib.isAdminUser).mockResolvedValue(false);

    const jsx = await AdminPage();
    render(jsx);

    expect(screen.getByText("403 Forbidden")).toBeInTheDocument();
    expect(screen.getByText("Administrator Privileges Required")).toBeInTheDocument();
    expect(screen.getByText(/non-admin-user-uuid/)).toBeInTheDocument();
    expect(screen.queryByText("System Overview & Metrics")).not.toBeInTheDocument();
  });

  it("allows verified admin access and renders metrics, users, and bootstrap info", async () => {
    const adminUser = { id: "admin-uuid-1234", email: "admin@lemon.internal" };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: adminUser }, error: null }),
      },
    } as unknown as SupabaseClient;

    vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);
    vi.mocked(adminLib.isAdminUser).mockResolvedValue(true);
    vi.mocked(adminLib.getAdminMetrics).mockResolvedValue({
      aggregate: { totalUsers: 42, totalSchedules: 99 },
      snapshot: {
        termId: "144820",
        termLabel: "الفصل الثاني 1448",
        collegeName: "كلية إدارة الأعمال",
        categoryLabel: "طلاب",
        importedAt: "2026-11-07T18:03:12.960Z",
        status: "verified-snapshot",
        coursesCount: 164,
        sectionsCount: 389,
        warningsCount: 0,
      },
      systemStatus: {
        databaseConfigured: true,
        serviceRoleConfigured: true,
        snapshotVerified: true,
      },
      unavailableMetrics: {
        "Live Banner Seat Capacity": "Unavailable (Static verified snapshot data only)",
      },
    });
    vi.mocked(adminLib.getAdminUsersList).mockResolvedValue([
      {
        id: "admin-uuid-1234",
        username: "lemonadmin",
        displayName: "Lemon Admin",
        createdAt: "2026-01-01T00:00:00Z",
        isAdmin: true,
      },
      {
        id: "student-uuid-5678",
        username: "learner",
        displayName: "Learner",
        createdAt: "2026-01-02T00:00:00Z",
        isAdmin: false,
      },
    ]);

    const jsx = await AdminPage();
    render(jsx);

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.getByText("System Overview & Metrics")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument(); // Total users
    expect(screen.getByText("99")).toBeInTheDocument(); // Total schedules
    expect(screen.getByText("164 Courses")).toBeInTheDocument();
    expect(screen.getByText("Unavailable (Static verified snapshot data only)")).toBeInTheDocument();

    // User management overview
    expect(screen.getByText("Lemon Admin")).toBeInTheDocument();
    expect(screen.getByText("@lemonadmin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("Standard User")).toBeInTheDocument();

    // Bootstrap SQL snippet
    expect(screen.getByText("Admin Bootstrap Reference")).toBeInTheDocument();
    expect(screen.getByText(/insert into public.app_admins/)).toBeInTheDocument();
  });

  describe("API authorization (/api/admin/metrics)", () => {
    it("denies unauthenticated request with 401", async () => {
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        },
      } as unknown as SupabaseClient;

      vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);

      const response = await getAdminMetricsApi();
      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error).toBe("Authentication required");
    });

    it("denies non-admin user request with 403", async () => {
      const mockUser = { id: "regular-user", email: "user@test.com" };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      } as unknown as SupabaseClient;

      vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);
      vi.mocked(adminLib.isAdminUser).mockResolvedValue(false);

      const response = await getAdminMetricsApi();
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toContain("Forbidden");
    });

    it("allows authorized admin request with 200 and metrics payload", async () => {
      const mockUser = { id: "admin-user", email: "admin@test.com" };
      const mockSupabase = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      } as unknown as SupabaseClient;

      vi.mocked(serverLib.getServerSupabase).mockResolvedValue(mockSupabase);
      vi.mocked(adminLib.isAdminUser).mockResolvedValue(true);
      vi.mocked(adminLib.getAdminMetrics).mockResolvedValue({
        aggregate: { totalUsers: 10, totalSchedules: 20 },
        snapshot: {
          termId: "144820",
          termLabel: "Term 144820",
          collegeName: "College",
          categoryLabel: "Students",
          importedAt: "2026-01-01T00:00:00Z",
          status: "verified-snapshot",
          coursesCount: 164,
          sectionsCount: 389,
          warningsCount: 0,
        },
        systemStatus: {
          databaseConfigured: true,
          serviceRoleConfigured: true,
          snapshotVerified: true,
        },
        unavailableMetrics: {},
      });

      const response = await getAdminMetricsApi();
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.aggregate.totalUsers).toBe(10);
    });
  });
});
