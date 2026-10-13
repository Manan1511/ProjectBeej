import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedTrackingContext } from "@/lib/tracking-context-validation";
import type { ConsentPreferences } from "@/lib/tracking-types";

let client: SupabaseClient | undefined;

export function trackingDatabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url) || !secretKey || secretKey.length < 24) {
    throw new Error("The separate tracking Supabase project is not configured.");
  }
  client = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5_000)]) : AbortSignal.timeout(5_000),
    }) },
  });
  return client;
}

export async function storeTrackingContext(input: {
  visitorId: string;
  contextId: string;
  context: ValidatedTrackingContext;
  clientIp?: string;
  userAgent?: string;
}): Promise<void> {
  const { error } = await trackingDatabase().rpc("tracking_create_context", {
    p_visitor_id: input.visitorId,
    p_context_id: input.contextId,
    p_consent: input.context.consent,
    p_attribution: input.context.attribution ?? null,
    p_identifiers: input.context.identifiers,
    p_client_ip: input.context.consent.marketing ? input.clientIp ?? null : null,
    p_user_agent: input.context.consent.marketing ? input.userAgent?.slice(0, 256) ?? null : null,
  });
  if (error) throw new Error("Tracking consent could not be saved.");
}

export type StoredCheckoutContext = {
  context_id: string;
  visitor_id: string;
  consent: ConsentPreferences;
  attribution: Record<string, unknown> | null;
  identifiers: Record<string, string>;
  client_ip: string | null;
  user_agent: string | null;
  created_at?: string;
};

export async function getStoredCheckoutContext(contextId: string, visitorId: string): Promise<StoredCheckoutContext | null> {
  const { data, error } = await trackingDatabase().from("tracking_checkout_contexts")
    .select("context_id,visitor_id,consent,attribution,identifiers,client_ip,user_agent,created_at")
    .eq("context_id", contextId).eq("visitor_id", visitorId).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Tracking context could not be loaded.");
  if (!data) return null;
  return data as StoredCheckoutContext;
}

export async function getCheckoutContextById(contextId: string): Promise<StoredCheckoutContext | null> {
  const { data, error } = await trackingDatabase().from("tracking_checkout_contexts")
    .select("context_id,visitor_id,consent,attribution,identifiers,client_ip,user_agent,created_at")
    .eq("context_id", contextId).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Tracking context could not be loaded.");
  if (!data) return null;
  return data as StoredCheckoutContext;
}

export async function getCurrentVisitorConsent(visitorId: string): Promise<ConsentPreferences | null> {
  const { data, error } = await trackingDatabase().from("tracking_visitors").select("consent").eq("visitor_id", visitorId).maybeSingle();
  if (error) throw new Error("Current tracking consent could not be loaded.");
  return data?.consent && typeof data.consent === "object" ? data.consent as ConsentPreferences : null;
}

export async function recordCheckoutTrackingEvent(contextId: string, eventId: string): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_record_checkout_event", { p_context_id: contextId, p_event_id: eventId });
  if (error) throw new Error("Checkout tracking event could not be deduplicated.");
  return data === true;
}

export async function getStoredOrderTracking(orderGid: string) {
  const { data, error } = await trackingDatabase().from("tracking_orders")
    .select("order_gid,transaction_id,currency,paid_at,consent,attribution,identifiers,test_order")
    .eq("order_gid", orderGid).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error("Order tracking correlation could not be loaded.");
  if (!data) return null;
  return data as Record<string, unknown>;
}

export async function reduceStoredConsent(contextId: string, consent: ConsentPreferences): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_reduce_consent", { p_context_id: contextId, p_consent: consent });
  if (error) throw new Error("Checkout consent could not be saved.");
  return data === true;
}

export type ProviderOutboxRow = {
  id: string;
  provider: "ga4" | "meta";
  event_name: string;
  event_id: string;
  order_gid: string;
  payload: Record<string, unknown>;
  attempts: number;
  payload_expires_at: string;
};

export async function claimProviderEvents(leaseToken: string): Promise<ProviderOutboxRow[]> {
  const { data, error } = await trackingDatabase().rpc("tracking_claim_outbox", { p_lease_token: leaseToken, p_limit: 4 });
  if (error) throw new Error("Tracking outbox could not be claimed.");
  return (data || []) as ProviderOutboxRow[];
}

export async function currentDispatchConsent(orderGid: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await trackingDatabase().rpc("tracking_dispatch_consent", { p_order_gid: orderGid });
  if (error) throw new Error("Current tracking consent could not be checked.");
  return data && typeof data === "object" ? data as Record<string, unknown> : null;
}

export async function finishProviderEvent(input: {
  id: string;
  leaseToken: string;
  status: "pending" | "delivered" | "manual" | "failed";
  nextAttemptAt?: string;
  errorCode?: string;
}): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_finish_outbox", {
    p_id: input.id,
    p_lease_token: input.leaseToken,
    p_status: input.status,
    p_next_attempt_at: input.nextAttemptAt ?? null,
    p_error_code: input.errorCode ?? null,
  });
  if (error) throw new Error("Tracking delivery status could not be saved.");
  return data === true;
}

export async function recordPaidOrder(input: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_record_paid_order", input);
  if (error) throw new Error("Shopify order event could not be stored.");
  return data === true;
}

export async function recordWebhookReceipt(input: { deliveryId: string; shopDomain: string; topic: string; orderGid?: string }): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_record_receipt", {
    p_delivery_id: input.deliveryId,
    p_shop_domain: input.shopDomain,
    p_topic: input.topic,
    p_order_gid: input.orderGid ?? null,
  });
  if (error) throw new Error("Shopify webhook receipt could not be saved.");
  return data === true;
}

export async function recordRefundReceipt(input: { deliveryId: string; shopDomain: string; topic: string; orderGid: string; refundGid: string }): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_record_refund", {
    p_delivery_id: input.deliveryId,
    p_shop_domain: input.shopDomain,
    p_topic: input.topic,
    p_order_gid: input.orderGid,
    p_refund_gid: input.refundGid,
  });
  if (error) throw new Error("Shopify refund receipt could not be saved.");
  return data === true;
}

export type PendingRefundRow = { refund_gid: string; order_gid: string; first_seen_at: string; attempts: number };

export async function claimPendingRefunds(leaseToken: string): Promise<PendingRefundRow[]> {
  const { data, error } = await trackingDatabase().rpc("tracking_claim_pending_refunds", { p_lease_token: leaseToken, p_limit: 4 });
  if (error) throw new Error("Pending Shopify refunds could not be claimed.");
  return (data || []) as PendingRefundRow[];
}

export async function finishRefundPoll(input: { refundGid: string; leaseToken: string; status: "pending" | "succeeded" | "failed" | "manual"; nextAttemptAt?: string; events?: unknown[] }): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_finish_refund_poll", {
    p_refund_gid: input.refundGid,
    p_lease_token: input.leaseToken,
    p_status: input.status,
    p_next_attempt_at: input.nextAttemptAt ?? null,
    p_events: input.events ?? [],
  });
  if (error) throw new Error("Refund poll status could not be saved.");
  return data === true;
}

export async function consumeDurableRateLimit(bucketKey: string): Promise<boolean> {
  const { data, error } = await trackingDatabase().rpc("tracking_consume_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: 5,
    p_window_seconds: 60,
  });
  if (error) throw new Error("Newsletter rate limit is unavailable.");
  return data === true;
}

export async function runTrackingCleanup(): Promise<void> {
  const { error } = await trackingDatabase().rpc("tracking_cleanup");
  if (error) throw new Error("Tracking retention cleanup failed.");
}
