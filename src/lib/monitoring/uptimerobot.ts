/**
 * UptimeRobot Availability Monitoring (LEMON-048)
 *
 * Checks public availability of the LEMON production web application.
 * Never monitors private or authenticated endpoints.
 */

export interface UptimeMonitorSummary {
  id: string;
  name: string;
  url: string;
  status: "up" | "down" | "paused" | "unknown";
  uptimeRatio: string;
  responseTimeMs?: number;
}

export interface UptimeRobotStatus {
  isConfigured: boolean;
  statusMessage: string;
  monitors: UptimeMonitorSummary[];
  recommendedConfig: {
    targetUrl: string;
    intervalMinutes: number;
    checkType: string;
  };
}

export async function getUptimeRobotStatus(): Promise<UptimeRobotStatus> {
  const apiKey = process.env.UPTIMEROBOT_API_KEY?.trim();
  const prodUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yourcampuspallemon.netlify.app";

  const recommendedConfig = {
    targetUrl: `${prodUrl}/api/health`,
    intervalMinutes: 5,
    checkType: "HTTP(s) 200 OK",
  };

  if (!apiKey) {
    return {
      isConfigured: false,
      statusMessage: "Ready for Setup: UPTIMEROBOT_API_KEY is not configured.",
      monitors: [],
      recommendedConfig,
    };
  }

  try {
    const res = await fetch("https://api.uptimerobot.com/v2/getMonitors", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cache-Control": "no-cache",
      },
      body: new URLSearchParams({
        api_key: apiKey,
        format: "json",
        response_times: "1",
      }).toString(),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return {
        isConfigured: true,
        statusMessage: `UptimeRobot API returned HTTP ${res.status}`,
        monitors: [],
        recommendedConfig,
      };
    }

    const data = (await res.json()) as {
      stat: string;
      monitors?: Array<{
        id: number | string;
        friendly_name: string;
        url: string;
        status: number;
        custom_uptime_ratio?: string;
        all_time_uptime_ratio?: string;
        response_times?: Array<{ value: number }>;
      }>;
    };

    if (data.stat !== "ok" || !data.monitors) {
      return {
        isConfigured: true,
        statusMessage: "UptimeRobot query returned non-ok status",
        monitors: [],
        recommendedConfig,
      };
    }

    const monitors: UptimeMonitorSummary[] = data.monitors.map((m) => {
      let status: UptimeMonitorSummary["status"] = "unknown";
      if (m.status === 2) status = "up";
      else if (m.status === 9) status = "down";
      else if (m.status === 0) status = "paused";

      const lastResponse = m.response_times?.[0]?.value;

      return {
        id: String(m.id),
        name: m.friendly_name,
        url: m.url,
        status,
        uptimeRatio: `${m.all_time_uptime_ratio || m.custom_uptime_ratio || "100"}%`,
        responseTimeMs: lastResponse,
      };
    });

    return {
      isConfigured: true,
      statusMessage: "Active: Monitoring public production availability",
      monitors,
      recommendedConfig,
    };
  } catch (err: unknown) {
    return {
      isConfigured: true,
      statusMessage: err instanceof Error ? err.message : "Error querying UptimeRobot",
      monitors: [],
      recommendedConfig,
    };
  }
}
