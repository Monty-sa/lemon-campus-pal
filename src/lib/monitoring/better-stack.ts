/**
 * Better Stack Heartbeat & Status Integration (LEMON-048)
 *
 * Monitors the scheduled Windows KFU Worker heartbeat.
 * Pings only after a verified, valid publication.
 */

export interface BetterStackStatus {
  isConfigured: boolean;
  heartbeatConfigured: boolean;
  statusMessage: string;
  workerPingsExpectedInterval: string;
  recommendedGracePeriod: string;
  statusPageUrl?: string;
}

export function getBetterStackStatus(): BetterStackStatus {
  const heartbeatUrl = process.env.BETTER_STACK_HEARTBEAT_URL?.trim();
  const statusPageUrl = process.env.BETTER_STACK_STATUS_PAGE_URL?.trim();

  const isConfigured = Boolean(heartbeatUrl || statusPageUrl);

  return {
    isConfigured,
    heartbeatConfigured: Boolean(heartbeatUrl),
    statusMessage: heartbeatUrl
      ? "Active: Windows KFU Worker sends authenticated heartbeats after verified publication."
      : "Ready for Setup: Set BETTER_STACK_HEARTBEAT_URL on the worker PC to monitor hourly KFU ingestion runs.",
    workerPingsExpectedInterval: "1 hour (matching Windows Task Scheduler hourly cadence)",
    recommendedGracePeriod: "20 minutes (accommodates KFU network latency & retries)",
    statusPageUrl: statusPageUrl || undefined,
  };
}

/**
 * Emits heartbeat ping from the worker process.
 */
export async function sendBetterStackHeartbeat(
  heartbeatUrl: string | undefined,
  status: "success" | "fail",
  message?: string,
): Promise<boolean> {
  if (!heartbeatUrl) return false;

  try {
    const targetUrl = status === "fail" ? `${heartbeatUrl.replace(/\/$/, "")}/fail` : heartbeatUrl;
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: message || (status === "success" ? "OK" : "FAILURE"),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
