import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";

type AdminResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function shopifyAdminQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const domain = getShopifyAdminStoreDomain();
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) {
    throw new Error("Shopify Admin API configuration is invalid.");
  }
  const token = await getShopifyAdminAccessToken();

  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Shopify could not save this sign-up.");
  const payload = (await response.json()) as AdminResponse<T>;
  if (payload.errors?.length || !payload.data) throw new Error("Shopify could not save this sign-up.");
  return payload.data;
}

export async function subscribeWithConsent(email: string): Promise<void> {
  const upsert = await shopifyAdminQuery<{
    customerSet: { customer: { id: string } | null; userErrors: Array<{ message: string }> };
  }>(
    `mutation BeejNewsletterCustomer($identifier: CustomerSetIdentifiers, $input: CustomerSetInput!) {
      customerSet(identifier: $identifier, input: $input) { customer { id } userErrors { message } }
    }`,
    { identifier: { email }, input: { email } },
  );
  const customer = upsert.customerSet.customer;
  if (upsert.customerSet.userErrors.length || !customer?.id) throw new Error("Shopify could not save this sign-up.");

  const consent = await shopifyAdminQuery<{
    customerEmailMarketingConsentUpdate: { customer: { id: string } | null; userErrors: Array<{ message: string }> };
  }>(
    `mutation BeejNewsletterConsent($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) { customer { id } userErrors { message } }
    }`,
    {
      input: {
        customerId: customer.id,
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: new Date().toISOString(),
        },
      },
    },
  );
  if (consent.customerEmailMarketingConsentUpdate.userErrors.length || !consent.customerEmailMarketingConsentUpdate.customer?.id) {
    throw new Error("Shopify could not save this sign-up.");
  }
}
