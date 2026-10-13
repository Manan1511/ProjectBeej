import { verifyConsentCapability, verifyShopifyWebhookHmac } from "@/lib/tracking-security";
import { getCheckoutContextById, recordPaidOrder, recordRefundReceipt, recordWebhookReceipt } from "@/lib/tracking-store";
import { buildPurchaseOutboxEvents } from "@/lib/tracking-conversions";
import { getTrackingProviderConfig } from "@/lib/tracking-server-config";

const MAX_BODY_BYTES = 1_000_000;
const DELIVERY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function id(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "string") {
    const match = String(value).match(/^(?:gid:\/\/shopify\/Order\/)?(\d+)$/);
    return match?.[1] || null;
  }
  return null;
}

function orderGid(value: unknown): string | null {
  if (typeof value === "string" && /^gid:\/\/shopify\/Order\/\d+$/.test(value)) return value;
  const numeric = id(value);
  return numeric ? `gid://shopify/Order/${numeric}` : null;
}

function refundGid(value: unknown): string | null {
  if (typeof value === "string" && /^gid:\/\/shopify\/Refund\/\d+$/.test(value)) return value;
  if (typeof value === "number" || typeof value === "string") {
    const match = String(value).match(/^(?:gid:\/\/shopify\/Refund\/)?(\d+)$/);
    return match ? `gid://shopify/Refund/${match[1]}` : null;
  }
  return null;
}

function trackingCapability(order: Record<string, unknown>): string | null {
  const attributes = Array.isArray(order.note_attributes) ? order.note_attributes : Array.isArray(order.cart_attributes) ? order.cart_attributes : [];
  for (const value of attributes) {
    const attribute = object(value);
    const key = attribute?.name ?? attribute?.key;
    if (key === "beej_tracking_context" && typeof attribute?.value === "string") return attribute.value;
  }
  return null;
}

export async function handleShopifyTrackingWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const webhookSecret = process.env.SHOPIFY_TRACKING_WEBHOOK_SECRET || process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  const signingSecret = process.env.TRACKING_SIGNING_SECRET;
  if (!webhookSecret || !signingSecret || signingSecret.length < 32) return json({ error: "Tracking webhook is not configured." }, 503);
  const shop = (request.headers.get("x-shopify-shop-domain") || "").toLowerCase();
  const expectedShop = (process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com").toLowerCase();
  const topic = (request.headers.get("x-shopify-topic") || "").toLowerCase();
  const deliveryId = request.headers.get("x-shopify-webhook-id") || "";
  const signature = request.headers.get("x-shopify-hmac-sha256");
  if (shop !== expectedShop) return json({ error: "Unexpected Shopify store." }, 403);
  if (!DELIVERY_ID.test(deliveryId) || !["orders/paid", "refunds/create"].includes(topic)) return json({ error: "Invalid Shopify webhook headers." }, 400);
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) return json({ error: "Webhook body is too large." }, 413);

  let rawBody: string;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: "Webhook body is too large." }, 413);
  } catch { return json({ error: "Webhook body could not be read." }, 400); }
  if (!verifyShopifyWebhookHmac(rawBody, signature, webhookSecret)) return json({ error: "Invalid Shopify webhook signature." }, 401);

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return json({ error: "Invalid Shopify webhook body." }, 400); }
  const webhook = object(payload);
  if (!webhook) return json({ error: "Invalid Shopify webhook body." }, 400);

  try {
    if (topic === "orders/paid") {
      const numericOrderId = id(webhook.id);
      const gid = orderGid(webhook.admin_graphql_api_id) || (numericOrderId ? `gid://shopify/Order/${numericOrderId}` : null);
      if (!gid || !numericOrderId) {
        await recordWebhookReceipt({ deliveryId, shopDomain: shop, topic });
        return json({ ok: true }, 200);
      }
      const capability = trackingCapability(webhook);
      const contextId = capability ? verifyConsentCapability(capability, signingSecret) : null;
      const context = contextId ? await getCheckoutContextById(contextId) : null;
      const paid = String(webhook.financial_status || "").toLowerCase() === "paid";
      if (!context || !paid || webhook.test === true) {
        await recordWebhookReceipt({ deliveryId, shopDomain: shop, topic, orderGid: gid });
        return json({ ok: true }, 200);
      }
      const config = getTrackingProviderConfig(process.env, process.env.CONTEXT);
      const events = buildPurchaseOutboxEvents(webhook, context, config);
      const currency = typeof webhook.currency === "string" ? webhook.currency.toUpperCase() : "";
      const paidAt = typeof webhook.processed_at === "string" ? webhook.processed_at : typeof webhook.created_at === "string" ? webhook.created_at : "";
      if (!/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Date.parse(paidAt))) {
        await recordWebhookReceipt({ deliveryId, shopDomain: shop, topic, orderGid: gid });
        return json({ ok: true }, 200);
      }
      const orderName = typeof webhook.name === "string" ? webhook.name.slice(0, 80) : numericOrderId;
      await recordPaidOrder({
        p_delivery_id: deliveryId,
        p_shop_domain: shop,
        p_topic: topic,
        p_order_gid: gid,
        p_order_name: orderName,
        p_context_id: context.context_id,
        p_transaction_id: numericOrderId,
        p_currency: currency,
        p_paid_at: paidAt,
        p_test_order: false,
        p_consent: context.consent,
        p_attribution: context.attribution,
        p_identifiers: context.identifiers,
        p_events: events,
      });
      return json({ ok: true }, 200);
    }

    const gid = orderGid(webhook.order_id) || orderGid(object(webhook.order)?.admin_graphql_api_id);
    const refundId = refundGid(webhook.admin_graphql_api_id) || refundGid(webhook.id);
    if (!gid || !refundId) {
      await recordWebhookReceipt({ deliveryId, shopDomain: shop, topic });
      return json({ ok: true }, 200);
    }
    await recordRefundReceipt({ deliveryId, shopDomain: shop, topic, orderGid: gid, refundGid: refundId });
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "Tracking webhook storage is temporarily unavailable." }, 503);
  }
}
