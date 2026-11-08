import { executeFullPipelineRefresh, isCronExecutionApproved } from "@/lib/kfu-monitor/pipeline";

export interface NetlifyHandlerResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

/**
 * Netlify Scheduled Function for KFU section monitoring.
 *
 * Configurable interval: @hourly (60 minutes).
 * Safety Policy: Requires explicit environment approval (KFU_MONITOR_CRON_ENABLED=true)
 * before any automated outbound requests to KFU servers will be initiated.
 *
 * Pipeline: FETCH → PARSE → VALIDATE → COMPARE → STAGE → ATOMIC PUBLISH → VERIFY.
 */
export async function handler(): Promise<NetlifyHandlerResponse> {
  if (!isCronExecutionApproved()) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "blocked_pending_approval",
        message:
          "Automated KFU polling is inactive pending explicit operator approval. Set KFU_MONITOR_CRON_ENABLED=true to authorize recurring background checks.",
      }),
    };
  }

  const result = await executeFullPipelineRefresh();
  const statusCode =
    result.status === "published" || result.status === "skipped_unchanged"
      ? 200
      : result.status === "locked"
      ? 429
      : 500;

  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result),
  };
}
