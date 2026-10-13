import { createHash, createHmac } from "node:crypto";
import { handleShopifyTrackingWebhook } from "@/lib/tracking-webhook-handler";
import { trackingDatabase } from "@/lib/tracking-store";
import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";

const ORDERS_QUERY = `query BeejReconcileRecentOrders($after: String, $query: String!) {
  orders(first: 100, after: $after, query: $query, sortKey: UPDATED_AT, reverse: false) {
    nodes {
      id legacyResourceId name displayFinancialStatus processedAt createdAt test currencyCode
      totalPriceSet { shopMoney { amount currencyCode } }
      subtotalPriceSet { shopMoney { amount currencyCode } }
      totalShippingPriceSet { shopMoney { amount currencyCode } }
      totalTaxSet { shopMoney { amount currencyCode } }
      customAttributes { key value }
      lineItems(first: 100) { nodes { title quantity originalUnitPriceSet { shopMoney { amount currencyCode } } discountedTotalSet { shopMoney { amount currencyCode } } variant { legacyResourceId } } }
      refunds { id legacyResourceId }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

type RawOrder = {
  id?: unknown; legacyResourceId?: unknown; name?: unknown; displayFinancialStatus?: unknown;
  processedAt?: unknown; createdAt?: unknown; test?: unknown; currencyCode?: unknown;
  totalPriceSet?: unknown; subtotalPriceSet?: unknown; totalShippingPriceSet?: unknown; totalTaxSet?: unknown;
  customAttributes?: unknown; lineItems?: { nodes?: unknown[] }; refunds?: unknown;
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function money(value: unknown): number | null {
  const bag = object(value);
  const shop = object(bag?.shopMoney);
  const amount = Number(shop?.amount);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function mapReconciledOrder(raw: RawOrder): Record<string, unknown> | null {
  const numericId = String(raw.legacyResourceId ?? "");
  if (!/^\d+$/.test(numericId) || typeof raw.id !== "string" || !/^gid:\/\/shopify\/Order\/\d+$/.test(raw.id)) return null;
  const lineItems = Array.isArray(raw.lineItems?.nodes) ? raw.lineItems.nodes.flatMap((entry) => {
    const line = object(entry);
    const variant = object(line?.variant);
    const quantity = Number(line?.quantity);
    const unit = money(line?.originalUnitPriceSet);
    const discounted = money(line?.discountedTotalSet);
    const variantId = String(variant?.legacyResourceId ?? "");
    if (!line || !/^\d+$/.test(variantId) || !Number.isSafeInteger(quantity) || quantity < 1 || unit === null || discounted === null || typeof line.title !== "string") return [];
    return [{ variant_id: variantId, quantity, title: line.title.slice(0, 160), price: unit.toFixed(2), total_discount: Math.max(0, unit * quantity - discounted).toFixed(2) }];
  }) : [];
  const customAttributes = Array.isArray(raw.customAttributes) ? raw.customAttributes.flatMap((entry) => {
    const attribute = object(entry);
    return attribute?.key === "beej_tracking_context" && typeof attribute.value === "string" ? [{ name: "beej_tracking_context", value: attribute.value }] : [];
  }) : [];
  return {
    id: numericId,
    admin_graphql_api_id: raw.id,
    name: typeof raw.name === "string" ? raw.name.slice(0, 80) : numericId,
    financial_status: typeof raw.displayFinancialStatus === "string" ? raw.displayFinancialStatus.toLowerCase() : "",
    processed_at: typeof raw.processedAt === "string" ? raw.processedAt : undefined,
    created_at: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    test: raw.test === true,
    currency: typeof raw.currencyCode === "string" ? raw.currencyCode : "",
    current_total_price_set: raw.totalPriceSet,
    current_subtotal_price_set: raw.subtotalPriceSet,
    current_total_shipping_price_set: raw.totalShippingPriceSet,
    current_total_tax: money(raw.totalTaxSet)?.toFixed(2),
    line_items: lineItems,
    note_attributes: customAttributes,
  };
}

export function deterministicReconciliationDeliveryId(topic: string, entityId: string): string {
  const hex = createHash("sha256").update(`project-beej:${topic}:${entityId}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function trackedOrderIds(orderGids: string[]): Promise<Set<string>> {
  if (!orderGids.length) return new Set();
  const { data, error } = await trackingDatabase().from("tracking_orders").select("order_gid").in("order_gid", orderGids);
  if (error) throw new Error("Tracking reconciliation lookup failed.");
  return new Set((data || []).map((row) => String(row.order_gid)));
}

async function shopifyOrders(after: string | null, since: string) {
  const domain = getShopifyAdminStoreDomain();
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) throw new Error("Tracking reconciliation is not configured.");
  const token = await getShopifyAdminAccessToken();
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: ORDERS_QUERY, variables: { after, query: `updated_at:>=${since} financial_status:paid` } }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Shopify order reconciliation is unavailable.");
  const payload = await response.json() as { data?: { orders?: { nodes?: RawOrder[]; pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } }; errors?: unknown[] };
  const connection = payload.data?.orders;
  if (payload.errors?.length || !connection || !Array.isArray(connection.nodes)) throw new Error("Shopify order reconciliation is unavailable.");
  return { orders: connection.nodes, hasNextPage: connection.pageInfo?.hasNextPage === true, endCursor: connection.pageInfo?.endCursor || null };
}

async function dispatchSynthetic(topic: "orders/paid" | "refunds/create", entityId: string, payload: Record<string, unknown>): Promise<void> {
  const secret = process.env.SHOPIFY_TRACKING_WEBHOOK_SECRET || process.env.SHOPIFY_ADMIN_CLIENT_SECRET || "";
  const shop = (process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com").toLowerCase();
  if (!secret) throw new Error("Shopify tracking webhook secret is not configured.");
  const rawBody = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
  const deliveryId = deterministicReconciliationDeliveryId(topic, entityId);
  const request = new Request("https://reconciliation.internal/api/webhooks/shopify/tracking", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-shop-domain": shop,
      "x-shopify-topic": topic,
      "x-shopify-webhook-id": deliveryId,
      "x-shopify-hmac-sha256": signature,
    },
    body: rawBody,
  });
  const response = await handleShopifyTrackingWebhook(request);
  if (!response.ok) throw new Error("Reconciled Shopify event could not be saved.");
}

export async function runDailyTrackingReconciliation(now = new Date()): Promise<{ scanned: number; recovered: number }> {
  if (process.env.CONTEXT !== "production") return { scanned: 0, recovered: 0 };
  const start = Date.now();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
  let after: string | null = null;
  let scanned = 0;
  let recovered = 0;
  let pages = 0;
  do {
    const page = await shopifyOrders(after, since);
    scanned += page.orders.length;
    const gids = page.orders.flatMap((order) => typeof order.id === "string" && /^gid:\/\/shopify\/Order\/\d+$/.test(order.id) ? [order.id] : []);
    const tracked = await trackedOrderIds(gids);
    for (const order of page.orders) {
      if (Date.now() - start > 17_000) return { scanned, recovered };
      const gid = typeof order.id === "string" ? order.id : "";
      if (!gid) continue;
      if (!tracked.has(gid)) {
        const normalized = mapReconciledOrder(order);
        if (normalized) {
          await dispatchSynthetic("orders/paid", gid, normalized);
          recovered += 1;
        }
      }
    }
    const nowTracked = await trackedOrderIds(gids);
    for (const order of page.orders) {
      const gid = typeof order.id === "string" ? order.id : "";
      if (!gid || order.test === true || !nowTracked.has(gid)) continue;
      const refundList = Array.isArray(order.refunds) ? order.refunds : [];
      for (const rawRefund of refundList) {
        const refund = object(rawRefund);
        const refundId = String(refund?.legacyResourceId ?? "");
        if (/^\d+$/.test(refundId)) await dispatchSynthetic("refunds/create", refundId, { id: refundId, admin_graphql_api_id: refund?.id, order_id: order.legacyResourceId });
      }
    }
    pages += 1;
    after = page.endCursor;
    if (!page.hasNextPage || !after || pages >= 20) break;
  } while (Date.now() - start < 17_000);
  return { scanned, recovered };
}
