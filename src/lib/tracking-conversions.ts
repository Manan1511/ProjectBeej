import type { StoredCheckoutContext } from "@/lib/tracking-store";

export type TrackingProviderConfig = {
  ga4MeasurementId: string;
  ga4ApiSecret: string;
  metaPixelId: string;
  metaAccessToken: string;
  metaApiVersion: string;
  siteUrl: string;
};

export type ProviderOutboxEvent = {
  provider: "ga4" | "meta";
  event_name: string;
  event_id: string;
  payload: Record<string, unknown>;
  payload_retention_hours?: number;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, max = 160): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

function finiteMoney(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 && amount < 1_000_000_000 ? Number(amount.toFixed(2)) : null;
}

function nestedMoney(source: Record<string, unknown>, key: string): { amount: number; currency: string } | null {
  const bag = record(source[key]);
  const shop = record(bag?.shop_money);
  const amount = finiteMoney(shop?.amount);
  const currency = text(shop?.currency_code, 3);
  return amount !== null && currency && /^[A-Z]{3}$/.test(currency) ? { amount, currency } : null;
}

function validClientId(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{1,20}\.\d{1,20}$/.test(value) ? value : undefined;
}

function validSessionId(value: unknown): string | undefined {
  return (typeof value === "string" || typeof value === "number") && /^\d{1,20}$/.test(String(value)) ? String(value) : undefined;
}

function timeWithin(date: Date, now: Date, maxAgeMs: number): boolean {
  const delta = now.getTime() - date.getTime();
  return Number.isFinite(delta) && delta >= 0 && delta <= maxAgeMs;
}

function orderItems(order: Record<string, unknown>) {
  if (!Array.isArray(order.line_items)) return [];
  return order.line_items.flatMap((entry) => {
    const line = record(entry);
    const variantId = line?.variant_id;
    const numericId = typeof variantId === "number" || typeof variantId === "string" ? String(variantId) : "";
    const quantity = Number(line?.quantity);
    const unitPrice = finiteMoney(line?.price);
    const totalDiscount = finiteMoney(line?.total_discount) ?? 0;
    const name = text(line?.title);
    if (!/^\d+$/.test(numericId) || !Number.isSafeInteger(quantity) || quantity < 1 || unitPrice === null || !name) return [];
    const price = Math.max(0, Number((unitPrice - totalDiscount / quantity).toFixed(2)));
    return [{ item_id: `beej_${numericId}`, item_name: name, price, quantity }];
  });
}

function campaignParams(context: StoredCheckoutContext): Record<string, string> {
  const attribution = record(context.attribution);
  const touch = record(attribution?.lastTouch);
  if (!touch) return {};
  const map: Record<string, string> = {
    utm_source: "campaign_source",
    utm_medium: "campaign_medium",
    utm_campaign: "campaign_name",
    utm_id: "campaign_id",
    utm_content: "campaign_content",
    utm_term: "campaign_term",
  };
  const result: Record<string, string> = {};
  for (const [utm, ga] of Object.entries(map)) {
    const value = text(touch[utm], 100);
    if (value && !/@|(?:\+?\d[\d\s().-]{6,}\d)/.test(value)) result[ga] = value;
  }
  return result;
}

export function buildPurchaseOutboxEvents(
  input: unknown,
  context: StoredCheckoutContext,
  config: TrackingProviderConfig,
  now = new Date(),
): ProviderOutboxEvent[] {
  const order = record(input);
  if (!order || order.test === true || !context || !context.consent) return [];
  const numericId = typeof order.id === "number" || typeof order.id === "string" ? String(order.id) : "";
  if (!/^\d+$/.test(numericId)) return [];
  const paidAtText = text(order.processed_at) || text(order.created_at);
  if (!paidAtText) return [];
  const paidAt = new Date(paidAtText);
  if (!Number.isFinite(paidAt.getTime()) || paidAt.getTime() > now.getTime()) return [];
  const currency = text(order.currency, 3) || nestedMoney(order, "current_total_price_set")?.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) return [];
  const charged = nestedMoney(order, "current_total_price_set")?.amount ?? finiteMoney(order.current_total_price);
  const merchandise = nestedMoney(order, "current_subtotal_price_set")?.amount ?? finiteMoney(order.current_subtotal_price ?? order.subtotal_price);
  if (charged === null || merchandise === null) return [];
  const shipping = nestedMoney(order, "current_total_shipping_price_set")?.amount ?? finiteMoney(order.total_shipping_price);
  const tax = finiteMoney(order.current_total_tax ?? order.total_tax);
  const items = orderItems(order);
  if (!items.length) return [];
  const eventId = `shopify_order_${numericId}_purchase`;
  const timestampSeconds = Math.floor(paidAt.getTime() / 1000);
  const timestampMicros = paidAt.getTime() * 1000;
  const events: ProviderOutboxEvent[] = [];

  const clientId = validClientId(context.identifiers.clientId);
  if (context.consent.analytics && clientId && config.ga4MeasurementId && config.ga4ApiSecret && timeWithin(paidAt, now, 72 * 60 * 60 * 1000)) {
    const contextCreated = context.created_at ? new Date(context.created_at) : null;
    const sessionId = validSessionId(context.identifiers.sessionId);
    const includeSession = Boolean(contextCreated && sessionId && Number.isFinite(contextCreated.getTime()) && paidAt.getTime() >= contextCreated.getTime() && paidAt.getTime() - contextCreated.getTime() <= 24 * 60 * 60 * 1000);
    const params: Record<string, unknown> = {
      transaction_id: numericId,
      currency,
      value: merchandise,
      items,
      ...campaignParams(context),
      ...(shipping !== null ? { shipping } : {}),
      ...(tax !== null ? { tax } : {}),
      ...(includeSession ? { session_id: sessionId, engagement_time_msec: 1 } : {}),
    };
    events.push({
      provider: "ga4",
      event_name: "purchase",
      event_id: eventId,
      payload: { client_id: clientId, timestamp_micros: timestampMicros, events: [{ name: "purchase", params }] },
    });
  }

  const identifiers = context.identifiers;
  const userData: Record<string, string> = {};
  if (context.consent.marketing) {
    if (typeof identifiers.fbp === "string" && /^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/.test(identifiers.fbp)) userData.fbp = identifiers.fbp;
    if (typeof identifiers.fbc === "string" && /^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/.test(identifiers.fbc)) userData.fbc = identifiers.fbc;
    if (context.client_ip && /^[0-9a-fA-F:.]{2,64}$/.test(context.client_ip)) userData.client_ip_address = context.client_ip;
    if (context.user_agent && context.user_agent.length <= 256) userData.client_user_agent = context.user_agent;
  }
  const metaEventId = eventId;
  const metaFresh = timeWithin(paidAt, now, 7 * 24 * 60 * 60 * 1000);
  if (context.consent.marketing && Object.keys(userData).length && config.metaPixelId && config.metaAccessToken && /^v\d{2,3}\.\d+$/.test(config.metaApiVersion) && metaFresh) {
    events.push({
      provider: "meta",
      event_name: "Purchase",
      event_id: metaEventId,
      payload: {
        data: [{
          event_name: "Purchase",
          event_time: timestampSeconds,
          event_id: metaEventId,
          event_source_url: `${config.siteUrl.replace(/\/$/, "")}/checkout`,
          action_source: "website",
          user_data: userData,
          custom_data: {
            currency,
            value: charged,
            order_id: numericId,
            content_ids: items.map((item) => item.item_id),
            content_type: "product",
            num_items: items.reduce((sum, item) => sum + item.quantity, 0),
          },
        }],
      },
      payload_retention_hours: 168,
    });
  }
  return events;
}

export function buildRefundOutboxEvents(
  input: unknown,
  orderTracking: Record<string, unknown>,
  config: TrackingProviderConfig,
  now = new Date(),
): { status: "pending" | "succeeded" | "failed" | "manual"; events: ProviderOutboxEvent[] } {
  const refund = record(input);
  if (!refund || orderTracking.test_order === true) return { status: "succeeded", events: [] };
  const transactions = Array.isArray(refund.transactions) ? refund.transactions.map(record).filter((item): item is Record<string, unknown> => Boolean(item)) : [];
  if (!transactions.length) return { status: "pending", events: [] };
  const statuses = transactions.map((transaction) => String(transaction.status || "").toLowerCase());
  const successful = statuses.filter((status) => status === "success").length;
  if (!successful && statuses.every((status) => ["failure", "failed", "error"].includes(status))) return { status: "failed", events: [] };
  if (successful !== transactions.length) return { status: successful > 0 ? "manual" : statuses.includes("pending") || statuses.includes("processing") ? "pending" : "manual", events: [] };

  const refundId = typeof refund.id === "number" || typeof refund.id === "string" ? String(refund.id).match(/(\d+)$/)?.[1] : undefined;
  const transactionId = text(orderTracking.transaction_id, 120);
  const processedAtText = text(refund.processed_at) || text(refund.created_at);
  if (!refundId || !transactionId || !processedAtText) return { status: "manual", events: [] };
  const processedAt = new Date(processedAtText);
  if (!Number.isFinite(processedAt.getTime()) || !timeWithin(processedAt, now, 72 * 60 * 60 * 1000)) return { status: "manual", events: [] };

  const rawLineItems = Array.isArray(refund.refund_line_items)
    ? refund.refund_line_items
    : record(refund.refundLineItems)?.nodes;
  if (!Array.isArray(rawLineItems)) return { status: "succeeded", events: [] };
  const items = rawLineItems.flatMap((entry) => {
    const item = record(entry);
    const line = record(item?.line_item) || record(item?.lineItem);
    const variant = line?.variant_id ?? record(line?.variant)?.id;
    const variantId = typeof variant === "number" || typeof variant === "string" ? String(variant).match(/(\d+)$/)?.[1] : undefined;
    const quantity = Number(item?.quantity);
    const amountBag = record(item?.subtotalSet);
    const amountShopMoney = record(amountBag?.shopMoney);
    const subtotal = finiteMoney(amountShopMoney?.amount ?? item?.subtotal);
    const title = text(line?.title);
    if (!variantId || !Number.isSafeInteger(quantity) || quantity < 1 || subtotal === null || !title) return [];
    return [{ item_id: `beej_${variantId}`, item_name: title, price: Number((subtotal / quantity).toFixed(2)), quantity }];
  });
  const value = rawLineItems.reduce((sum, entry) => {
    const item = record(entry);
    const bag = record(item?.subtotalSet);
    const money = record(bag?.shopMoney);
    return sum + (finiteMoney(money?.amount ?? item?.subtotal) ?? 0);
  }, 0);
  if (value <= 0 || !items.length) return { status: "succeeded", events: [] };

  const consent = record(orderTracking.consent);
  const identifiers = record(orderTracking.identifiers);
  const clientId = validClientId(identifiers?.clientId);
  const refundTotal = record(refund.totalRefundedSet);
  const refundShopMoney = record(refundTotal?.shopMoney);
  const currency = text(refundShopMoney?.currencyCode, 3)
    || text(transactions[0]?.currency, 3)
    || text(orderTracking.currency, 3);
  if (consent?.analytics !== true || !clientId || !config.ga4MeasurementId || !config.ga4ApiSecret || !currency || !/^[A-Z]{3}$/.test(currency)) {
    return { status: "succeeded", events: [] };
  }
  const eventId = `shopify_refund_${refundId}_refund`;
  return {
    status: "succeeded",
    events: [{
      provider: "ga4",
      event_name: "refund",
      event_id: eventId,
      payload: {
        client_id: clientId,
        timestamp_micros: processedAt.getTime() * 1000,
        events: [{ name: "refund", params: { transaction_id: transactionId, value: Number(value.toFixed(2)), currency, items } }],
      },
    }],
  };
}
