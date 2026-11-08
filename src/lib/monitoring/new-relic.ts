/**
 * New Relic Observability & Performance Monitoring (LEMON-048)
 *
 * Performance Guarantees:
 * - Disabled by default to preserve LEMON's lightweight Core Web Vitals targets.
 * - Zero credentials bundled into client/browser bundles.
 * - External console setup documentation provided for the owner.
 */

export interface NewRelicStatus {
  isConfigured: boolean;
  statusMessage: string;
  appId?: string;
  dashboardUrl?: string;
}

export function getNewRelicStatus(): NewRelicStatus {
  const licenseKey = process.env.NEW_RELIC_LICENSE_KEY?.trim();
  const appId = process.env.NEW_RELIC_APP_ID?.trim();

  const isConfigured = Boolean(licenseKey && appId);

  return {
    isConfigured,
    statusMessage: isConfigured
      ? "Configured on server-side runtime."
      : "Disabled / Ready for Setup: Heavy browser agent disabled by default to maintain LIGHTSPEED budget.",
    appId: appId || undefined,
    dashboardUrl: appId
      ? `https://one.newrelic.com/redirect/entity/${appId}`
      : undefined,
  };
}
