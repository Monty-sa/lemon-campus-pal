import { describe, expect, it, vi } from "vitest";
import { getAdminMetrics, getAdminUsersList, isAdminUser, getAdminPrivilegedSupabase } from "./admin";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeMockSupabase(overrides?: {
  admins?: { user_id: string }[];
  profiles?: { id: string; username: string; display_name: string; created_at: string }[];
  schedulesCount?: number;
}) {
  const admins = overrides?.admins ?? [];
  const profiles = overrides?.profiles ?? [];

  return {
    from: vi.fn((table: string) => {
      if (table === "app_admins") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((...args: string[]) => ({
              maybeSingle: vi.fn(async () => {
                const found = admins.find((a) => a.user_id === args[1]);
                return { data: found ?? null, error: null };
              }),
            })),
            then: (resolve: (val: unknown) => void) => resolve({ data: admins, error: null }),
          })),
        };
      }
      if (table === "profiles") {
        return {
          select: vi.fn((...args: unknown[]) => {
            const opts = args[1] as { count?: string; head?: boolean } | undefined;
            if (opts?.count === "exact") {
              return Promise.resolve({ count: profiles.length, error: null });
            }
            return {
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: profiles, error: null })),
              })),
            };
          }),
        };
      }
      if (table === "schedules") {
        return {
          select: vi.fn(() => {
            return Promise.resolve({ count: overrides?.schedulesCount ?? 0, error: null });
          }),
        };
      }
      return {};
    }),
  } as unknown as SupabaseClient;
}

describe("Admin authorization and metrics (LEMON-010F)", () => {
  it("authorizes user present in app_admins", async () => {
    const client = makeMockSupabase({
      admins: [{ user_id: "admin-uuid-1" }],
    });

    const isAuthorized = await isAdminUser(client, "admin-uuid-1");
    expect(isAuthorized).toBe(true);
  });

  it("denies user not in app_admins", async () => {
    const client = makeMockSupabase({
      admins: [{ user_id: "admin-uuid-1" }],
    });

    const isAuthorized = await isAdminUser(client, "regular-uuid-2");
    expect(isAuthorized).toBe(false);
  });

  it("denies access when userId is empty", async () => {
    const client = makeMockSupabase();
    expect(await isAdminUser(client, "")).toBe(false);
  });

  it("gathers admin metrics with snapshot freshness and labeled unavailable metrics", async () => {
    const client = makeMockSupabase({
      profiles: [
        { id: "1", username: "alice", display_name: "Alice", created_at: "2026-01-01T00:00:00Z" },
      ],
      schedulesCount: 5,
    });

    const metrics = await getAdminMetrics(client, client);

    expect(metrics.snapshot.termId).toBe("144820");
    expect(metrics.snapshot.coursesCount).toBe(164);
    expect(metrics.snapshot.sectionsCount).toBe(389);
    expect(metrics.snapshot.status).toBe("verified-snapshot");

    // Aggregate counts
    expect(metrics.aggregate.totalUsers).toBe(1);
    expect(metrics.aggregate.totalSchedules).toBe(5);

    // Unavailable metrics are explicitly marked
    expect(metrics.unavailableMetrics["Live Banner Seat Capacity"]).toContain("Unavailable");
    expect(metrics.unavailableMetrics["Real-time WebSocket Clients"]).toContain("Unavailable");
  });

  it("fetches user management overview without exposing sensitive auth data", async () => {
    const client = makeMockSupabase({
      admins: [{ user_id: "u-1" }],
      profiles: [
        { id: "u-1", username: "superadmin", display_name: "Super Admin", created_at: "2026-01-01T00:00:00Z" },
        { id: "u-2", username: "student99", display_name: "Student", created_at: "2026-01-02T00:00:00Z" },
      ],
    });

    const users = await getAdminUsersList(client);

    expect(users).toHaveLength(2);
    expect(users[0]).toEqual({
      id: "u-1",
      username: "superadmin",
      displayName: "Super Admin",
      createdAt: "2026-01-01T00:00:00Z",
      isAdmin: true,
    });
    expect(users[1].isAdmin).toBe(false);

    // Verify no password, token, or schedule fields are present
    users.forEach((u) => {
      expect(u).not.toHaveProperty("password");
      expect(u).not.toHaveProperty("encrypted_password");
      expect(u).not.toHaveProperty("schedules");
      expect(u).not.toHaveProperty("email");
    });
  });

  it("prevents browser runtime instantiation of privileged client", () => {
    const originalWindow = globalThis.window;
    try {
      // @ts-expect-error test simulation of browser window
      globalThis.window = {};
      expect(() => getAdminPrivilegedSupabase()).toThrow("Privileged Supabase client cannot be instantiated in browser runtime.");
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
