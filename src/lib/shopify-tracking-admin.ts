import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";

type AdminResponse<T> = { data?: T; errors?: Array<{ message?: string }> };

const REFUND_QUERY = `query BeejTrackingRefund($id: ID!) {
  node(id: $id) {
    ... on Refund {
      id createdAt processedAt
      totalRefundedSet { shopMoney { amount currencyCode } }
      transactions(first: 50) { nodes { status kind amountSet { shopMoney { amount currencyCode } } } }
      refundLineItems(first: 50) { nodes { quantity subtotalSet { shopMoney { amount currencyCode } } lineItem { title variant { id } } } }
      order { id }
    }
  }
}`;

export async function getShopifyRefundStatus(refundGid: string): Promise<Record<string, unknown> | null> {
  const domain = getShopifyAdminStoreDomain();
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) throw new Error("Shopify tracking Admin API is not configured.");
  if (!/^gid:\/\/shopify\/Refund\/\d+$/.test(refundGid)) throw new Error("Invalid Shopify refund ID.");
  const token = await getShopifyAdminAccessToken();
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query: REFUND_QUERY, variables: { id: refundGid } }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Shopify refund status is unavailable.");
  const payload = await response.json() as AdminResponse<{ node: Record<string, unknown> | null }>;
  if (payload.errors?.length || !payload.data) throw new Error("Shopify refund status is unavailable.");
  return payload.data.node;
}
