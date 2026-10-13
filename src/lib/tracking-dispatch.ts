import {
  claimPendingRefunds,
  claimProviderEvents,
  currentDispatchConsent,
  finishProviderEvent,
  finishRefundPoll,
  getStoredOrderTracking,
  type ProviderOutboxRow,
  runTrackingCleanup,
} from "@/lib/tracking-store";
import { getTrackingProviderConfig } from "@/lib/tracking-server-config";
import { nextTrackingRetry, providerConsentAllowed, providerTimestampExpired } from "@/lib/tracking-worker-policy";
import type { ConsentPreferences } from "@/lib/tracking-types";
import { getShopifyRefundStatus } from "@/lib/shopify-tracking-admin";
import { buildRefundOutboxEvents } from "@/lib/tracking-conversions";

const WORKER_BUDGET_MS = 20_000;
const PROVIDER_TIMEOUT_MS = 5_000;

function consent(value: unknown): Partial<ConsentPreferences> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  return {
    ...(typeof source.analytics === "boolean" ? { analytics: source.analytics } : {}),
    ...(typeof source.marketing === "boolean" ? { marketing: source.marketing } : {}),
    ...(typeof source.preferences === "boolean" ? { preferences: source.preferences } : {}),
  };
}

async function update(row: ProviderOutboxRow, leaseToken: string, status: "pending" | "delivered" | "manual" | "failed", errorCode?: string) {
  return finishProviderEvent({
    id: row.id,
    leaseToken,
    status,
    ...(status === "pending" ? { nextAttemptAt: nextTrackingRetry(row.attempts)?.toISOString() } : {}),
    ...(errorCode ? { errorCode } : {}),
  });
}

async function sendProviderEvent(row: ProviderOutboxRow, config: ReturnType<typeof getTrackingProviderConfig>, startedAt: number, leaseToken: string): Promise<void> {
  const isGaRefund = row.provider === "ga4" && row.event_name === "refund";
  try {
    if (Date.now() - startedAt >= WORKER_BUDGET_MS) {
      await update(row, leaseToken, "pending", "worker_budget");
      return;
    }
    if (Date.parse(row.payload_expires_at) <= Date.now()) {
      await update(row, leaseToken, isGaRefund ? "manual" : "failed", "payload_expired");
      return;
    }
    const state = await currentDispatchConsent(row.order_gid);
    const orderConsent = consent(state?.order_consent);
    const currentConsent = consent(state?.current_consent);
    if (!state || state.test_order === true || !providerConsentAllowed(row.provider, orderConsent, currentConsent)) {
      await update(row, leaseToken, "failed", "consent_withdrawn");
      return;
    }
    if (row.provider === "ga4" && providerTimestampExpired(row.payload, new Date(), 72)) {
      await update(row, leaseToken, isGaRefund ? "manual" : "failed", "timestamp_expired");
      return;
    }

    let endpoint: string;
    if (row.provider === "ga4") {
      if (!config.ga4MeasurementId || !config.ga4ApiSecret) {
        await update(row, leaseToken, "failed", "provider_not_configured");
        return;
      }
      endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.ga4MeasurementId)}&api_secret=${encodeURIComponent(config.ga4ApiSecret)}`;
    } else {
      if (!config.metaPixelId || !config.metaAccessToken || !config.metaApiVersion) {
        await update(row, leaseToken, "failed", "provider_not_configured");
        return;
      }
      endpoint = `https://graph.facebook.com/${config.metaApiVersion}/${encodeURIComponent(config.metaPixelId)}/events?access_token=${encodeURIComponent(config.metaAccessToken)}`;
    }

    // Consent is rechecked immediately before dispatch; provider secrets never enter the stored payload.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(row.payload),
      cache: "no-store",
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    });
    if (response.ok) {
      if (row.provider === "meta") {
        const result = await response.json().catch(() => null) as { error?: unknown } | null;
        if (result?.error) {
          await update(row, leaseToken, "failed", "meta_rejected");
          return;
        }
      }
      await update(row, leaseToken, "delivered");
      return;
    }
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      const retryAt = nextTrackingRetry(row.attempts);
      if (isGaRefund) await update(row, leaseToken, "manual", "ambiguous_ga4_refund");
      else if (retryAt) await finishProviderEvent({ id: row.id, leaseToken, status: "pending", nextAttemptAt: retryAt.toISOString(), errorCode: `http_${response.status}` });
      else await update(row, leaseToken, "failed", "retry_limit");
      return;
    }
    await update(row, leaseToken, "failed", `http_${response.status}`);
  } catch {
    if (isGaRefund) {
      await update(row, leaseToken, "manual", "ambiguous_ga4_refund").catch(() => false);
      return;
    }
    const retryAt = nextTrackingRetry(row.attempts);
    if (retryAt) await finishProviderEvent({ id: row.id, leaseToken, status: "pending", nextAttemptAt: retryAt.toISOString(), errorCode: "provider_timeout" }).catch(() => false);
    else await update(row, leaseToken, "failed", "retry_limit").catch(() => false);
  }
}

export async function runTrackingOutbox(): Promise<{ claimed: number }> {
  const startedAt = Date.now();
  const leaseToken = crypto.randomUUID();
  const rows = await claimProviderEvents(leaseToken);
  const config = getTrackingProviderConfig(process.env, process.env.CONTEXT);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < rows.length) {
      const row = rows[nextIndex++];
      if (row) await sendProviderEvent(row, config, startedAt, leaseToken);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, rows.length) }, () => worker()));
  return { claimed: rows.length };
}

export async function pollPendingShopifyRefunds(): Promise<{ claimed: number }> {
  const leaseToken = crypto.randomUUID();
  const rows = await claimPendingRefunds(leaseToken);
  let nextIndex = 0;
  const processRow = async (row: typeof rows[number]) => {
    const firstSeen = new Date(row.first_seen_at);
    if (!Number.isFinite(firstSeen.getTime()) || Date.now() - firstSeen.getTime() >= 7 * 24 * 60 * 60 * 1000) {
      await finishRefundPoll({ refundGid: row.refund_gid, leaseToken, status: "manual" });
      return;
    }
    try {
      const result = await getShopifyRefundStatus(row.refund_gid);
      if (!result) {
        await finishRefundPoll({ refundGid: row.refund_gid, leaseToken, status: "pending", nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString() });
        return;
      }
      const orderTracking = await getStoredOrderTracking(row.order_gid);
      if (!orderTracking) {
        await finishRefundPoll({ refundGid: row.refund_gid, leaseToken, status: "succeeded" });
        return;
      }
      const dispatch = await currentDispatchConsent(row.order_gid);
      const originalConsent = consent(orderTracking.consent);
      const currentConsent = consent(dispatch?.current_consent);
      const eligibleOrder = {
        ...orderTracking,
        consent: {
          analytics: originalConsent?.analytics === true && currentConsent?.analytics === true,
          marketing: originalConsent?.marketing === true && currentConsent?.marketing === true,
          preferences: originalConsent?.preferences === true && currentConsent?.preferences === true,
        },
      };
      const refund = {
        ...result,
        processed_at: result.processedAt || result.createdAt,
        refundLineItems: result.refundLineItems,
        transactions: (result.transactions as { nodes?: unknown[] } | undefined)?.nodes || [],
      };
      const conversion = buildRefundOutboxEvents(refund, eligibleOrder, getTrackingProviderConfig(process.env, process.env.CONTEXT));
      if (conversion.status === "pending") {
        await finishRefundPoll({ refundGid: row.refund_gid, leaseToken, status: "pending", nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString() });
      } else {
        await finishRefundPoll({ refundGid: row.refund_gid, leaseToken, status: conversion.status, events: conversion.events });
      }
    } catch {
      const age = Date.now() - firstSeen.getTime();
      await finishRefundPoll({
        refundGid: row.refund_gid,
        leaseToken,
        status: age >= 7 * 24 * 60 * 60 * 1000 ? "manual" : "pending",
        ...(age < 7 * 24 * 60 * 60 * 1000 ? { nextAttemptAt: new Date(Date.now() + 15 * 60_000).toISOString() } : {}),
      }).catch(() => false);
    }
  };
  const worker = async () => {
    while (nextIndex < rows.length) {
      const row = rows[nextIndex++];
      if (row) await processRow(row);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, rows.length) }, () => worker()));
  return { claimed: rows.length };
}

export async function runTrackingRecovery(): Promise<void> {
  await runTrackingOutbox();
  await pollPendingShopifyRefunds();
  await runTrackingCleanup();
}
