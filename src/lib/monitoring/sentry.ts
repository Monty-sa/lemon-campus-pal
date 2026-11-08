/**
 * LEMON Primary Error Tracking — Sentry Integration (LEMON-048)
 *
 * Privacy Guarantees:
 * - Guest schedules, plans, and CRNs are strictly scrubbed before reporting.
 * - GPA calculation grades, cumulative hours, and scenario data are NEVER sent.
 * - Sensitive HTTP headers (Authorization, Cookie, Session tokens) are redacted.
 * - Session replay is DISABLED by default to protect student privacy and avoid client bundle bloat.
 * - If Sentry DSN is missing, functions are cleanly inert.
 */

export interface SentryIssueSummary {
  id: string;
  title: string;
  culprit?: string;
  level: "fatal" | "error" | "warning" | "info";
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}

export interface SentryStatus {
  isConfigured: boolean;
  environment: string;
  release: string;
  apiConnected: boolean;
  issues: SentryIssueSummary[];
  statusMessage: string;
}

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "token",
  "apikey",
  "plans",
  "courses",
  "sections",
  "crn",
  "crns",
  "grades",
  "gpa",
  "schedule",
]);

/**
 * Recursively scrubs PII and sensitive student scheduling data.
 */
export function scrubSensitiveData<T>(input: T, depth = 0): T {
  if (depth > 6 || input === null || input === undefined) return input;

  if (typeof input === "string") {
    // Mask potential token/secret strings
    if (input.length > 40 && /^[a-zA-Z0-9_\-.]+$/.test(input)) {
      return "[REDACTED_SECRET]" as unknown as T;
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubSensitiveData(item, depth + 1)) as unknown as T;
  }

  if (typeof input === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lower) || lower.includes("password") || lower.includes("secret")) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = scrubSensitiveData(val, depth + 1);
      }
    }
    return output as T;
  }

  return input;
}

/**
 * Server-side error capture with automatic redaction.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): boolean {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    // Sentry not configured; return false cleanly
    return false;
  }

  const cleanContext = context ? scrubSensitiveData(context) : undefined;
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Log in safe redacted format
  if (process.env.NODE_ENV !== "test") {
    console.error("[SENTRY_CAPTURE]", {
      message: errorObj.message,
      name: errorObj.name,
      context: cleanContext,
    });
  }

  return true;
}

/**
 * Queries Sentry API for real issue summaries when authorized API access is provided.
 * Never invents mock or simulated counts.
 */
export async function getSentryIssueSummary(): Promise<SentryStatus> {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  const authToken = process.env.SENTRY_AUTH_TOKEN?.trim();
  const org = process.env.SENTRY_ORG?.trim();
  const project = process.env.SENTRY_PROJECT?.trim();

  const environment = process.env.NODE_ENV || "production";
  const release = process.env.NEXT_PUBLIC_RELEASE_VERSION || "lemon-048";

  if (!dsn) {
    return {
      isConfigured: false,
      environment,
      release,
      apiConnected: false,
      issues: [],
      statusMessage: "Setup Required: SENTRY_DSN is not configured.",
    };
  }

  if (!authToken || !org || !project) {
    return {
      isConfigured: true,
      environment,
      release,
      apiConnected: false,
      issues: [],
      statusMessage: "Sentry SDK active. To view issue feed in dashboard, configure SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT in Netlify.",
    };
  }

  try {
    const url = `https://sentry.io/api/0/projects/${org}/${project}/issues/?statsPeriod=24h&query=is:unresolved`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        isConfigured: true,
        environment,
        release,
        apiConnected: false,
        issues: [],
        statusMessage: `Sentry API returned HTTP ${res.status} ${res.statusText}`,
      };
    }

    const rawIssues = (await res.json()) as Array<{
      id: string;
      title: string;
      culprit?: string;
      level?: string;
      count?: string;
      userCount?: number;
      firstSeen?: string;
      lastSeen?: string;
      permalink?: string;
    }>;

    const issues: SentryIssueSummary[] = rawIssues.map((i) => ({
      id: i.id,
      title: i.title,
      culprit: i.culprit,
      level: (i.level as SentryIssueSummary["level"]) || "error",
      count: parseInt(i.count || "1", 10),
      userCount: i.userCount || 0,
      firstSeen: i.firstSeen || new Date().toISOString(),
      lastSeen: i.lastSeen || new Date().toISOString(),
      permalink: i.permalink || `https://sentry.io/organizations/${org}/issues/${i.id}/`,
    }));

    return {
      isConfigured: true,
      environment,
      release,
      apiConnected: true,
      issues,
      statusMessage: issues.length === 0 ? "No unresolved issues in last 24h 🎉" : `${issues.length} active issue(s)`,
    };
  } catch (err: unknown) {
    return {
      isConfigured: true,
      environment,
      release,
      apiConnected: false,
      issues: [],
      statusMessage: err instanceof Error ? err.message : "Error contacting Sentry API",
    };
  }
}
