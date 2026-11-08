import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { offerings } from "@/data/offerings";

export type AdminUserSummary = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
  isAdmin: boolean;
};

export type AdminMetrics = {
  aggregate: {
    totalUsers: number | "Unavailable (Service Role required)";
    totalSchedules: number | "Unavailable (Service Role required)";
  };
  snapshot: {
    termId: string;
    termLabel: string;
    collegeName: string;
    categoryLabel: string;
    importedAt: string;
    status: string;
    coursesCount: number;
    sectionsCount: number;
    warningsCount: number;
  };
  systemStatus: {
    databaseConfigured: boolean;
    serviceRoleConfigured: boolean;
    snapshotVerified: boolean;
  };
  unavailableMetrics: Record<string, string>;
};

/**
 * Checks whether the given user has an entry in public.app_admins.
 * Server-enforced via direct database query and RLS.
 */
export async function isAdminUser(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await client
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return false;
    return data.user_id === userId;
  } catch {
    return false;
  }
}

/**
 * Creates a server-only privileged client using SUPABASE_SERVICE_ROLE_KEY.
 * Strictly forbidden from being called in client-side code or bundled into browser code.
 */
export function getAdminPrivilegedSupabase(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("Privileged Supabase client cannot be instantiated in browser runtime.");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const config = getSupabaseConfig();

  if (!serviceKey || !config?.url) return null;

  return createClient(config.url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Compiles admin overview metrics for the /admin dashboard.
 */
export async function getAdminMetrics(
  userClient: SupabaseClient,
  privilegedClient?: SupabaseClient | null,
): Promise<AdminMetrics> {
  let totalUsers: number | "Unavailable (Service Role required)" = "Unavailable (Service Role required)";
  let totalSchedules: number | "Unavailable (Service Role required)" = "Unavailable (Service Role required)";

  const clientToUse = privilegedClient ?? userClient;

  try {
    const { count: usersCount, error: usersErr } = await clientToUse
      .from("profiles")
      .select("*", { count: "exact", head: true });
    if (!usersErr && typeof usersCount === "number") {
      totalUsers = usersCount;
    }
  } catch {
    // Falls back to Unavailable
  }

  try {
    // Schedules are owner-only with RLS. Only a privileged service client can read total count.
    if (privilegedClient) {
      const { count: schedulesCount, error: schedErr } = await privilegedClient
        .from("schedules")
        .select("*", { count: "exact", head: true });
      if (!schedErr && typeof schedulesCount === "number") {
        totalSchedules = schedulesCount;
      }
    }
  } catch {
    // Falls back to Unavailable
  }

  return {
    aggregate: {
      totalUsers,
      totalSchedules,
    },
    snapshot: {
      termId: offerings.term.id,
      termLabel: offerings.term.labelAr,
      collegeName: offerings.college.nameAr,
      categoryLabel: offerings.studentCategory?.labelAr ?? "Not specified",
      importedAt: offerings.importedAt,
      status: offerings.status,
      coursesCount: offerings.courses.length,
      sectionsCount: offerings.sections.length,
      warningsCount: offerings.warnings.length,
    },
    systemStatus: {
      databaseConfigured: Boolean(getSupabaseConfig()?.url),
      serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      snapshotVerified: offerings.status === "verified-snapshot",
    },
    unavailableMetrics: {
      "Live Banner Seat Capacity": "Unavailable (Static verified snapshot data only)",
      "Real-time WebSocket Clients": "Unavailable (Stateless serverless deployment)",
      "Active Push Notifications": "Unavailable (Feature not configured)",
    },
  };
}

/**
 * Returns minimal necessary user metadata for the admin overview.
 * Never exposes private schedules, authentication passwords, or tokens.
 */
export async function getAdminUsersList(
  userClient: SupabaseClient,
  privilegedClient?: SupabaseClient | null,
): Promise<AdminUserSummary[]> {
  const clientToUse = privilegedClient ?? userClient;

  try {
    const { data: profiles, error } = await clientToUse
      .from("profiles")
      .select("id, username, display_name, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !profiles) return [];

    // Query admin allowlist to mark who is an admin
    const { data: admins } = await clientToUse
      .from("app_admins")
      .select("user_id");

    const adminSet = new Set((admins ?? []).map((a) => a.user_id));

    return profiles.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      createdAt: p.created_at,
      isAdmin: adminSet.has(p.id),
    }));
  } catch {
    return [];
  }
}
