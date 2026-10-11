import "server-only";
const windows = new Map<string, { count: number; resetsAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

export function consumeNewsletterRateLimit(key: string, now = Date.now()): boolean {
  const current = windows.get(key);
  if (!current || current.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

type AdminResponse<T> = { data?: T; errors?: Array<{ message: string }> };

async function shopifyAdminQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const domain = process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com";
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!token) throw new Error("Newsletter sign-up is not configured yet.");
  if (!/^[-a-z0-9]+\.myshopify\.com$/i.test(domain) || !/^\d{4}-\d{2}$/.test(version)) {
    throw new Error("Shopify Admin API configuration is invalid.");
  }

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
