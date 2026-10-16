import { createHash } from "node:crypto";

type ShopifyTokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type CachedToken = {
  key: string;
  accessToken: string;
  refreshAt: number;
};

type PendingTokenRequest = {
  key: string;
  promise: Promise<{ accessToken: string; refreshAt: number }>;
};

let cachedToken: CachedToken | null = null;
let pendingTokenRequest: PendingTokenRequest | null = null;

const DEFAULT_SHOPIFY_DOMAIN = "projectbeej-1686bmnd.myshopify.com";

export function getShopifyAdminStoreDomain(): string {
  const domain = (process.env.SHOPIFY_STORE_DOMAIN || DEFAULT_SHOPIFY_DOMAIN).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) {
    throw new Error("Shopify Admin store domain is invalid.");
  }
  return domain;
}

function getCredentials(): { domain: string; clientId: string; clientSecret: string; key: string } {
  const domain = getShopifyAdminStoreDomain();
  const clientId = process.env.SHOPIFY_ADMIN_CLIENT_ID?.trim();
  const clientSecret = process.env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Shopify Admin app credentials are not configured.");

  const key = createHash("sha256").update(`${domain}\0${clientId}\0${clientSecret}`).digest("hex");
  return { domain, clientId, clientSecret, key };
}

async function requestToken(domain: string, clientId: string, clientSecret: string): Promise<{ accessToken: string; refreshAt: number }> {
  try {
    const response = await fetch(`https://${domain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Shopify token request failed.");

    const payload = await response.json() as ShopifyTokenResponse;
    const expiresIn = Number(payload.expires_in);
    if (typeof payload.access_token !== "string" || !payload.access_token || !Number.isFinite(expiresIn) || expiresIn <= 1) {
      throw new Error("Shopify token response is invalid.");
    }

    const lifetimeMs = expiresIn * 1_000;
    const refreshMarginMs = Math.min(60_000, Math.max(1_000, Math.floor(lifetimeMs / 10)));
    return { accessToken: payload.access_token, refreshAt: Date.now() + lifetimeMs - refreshMarginMs };
  } catch {
    throw new Error("Shopify Admin access token could not be obtained.");
  }
}

export async function getShopifyAdminAccessToken(): Promise<string> {
  const { domain, clientId, clientSecret, key } = getCredentials();
  const now = Date.now();
  if (cachedToken?.key === key && now < cachedToken.refreshAt) return cachedToken.accessToken;
  if (pendingTokenRequest?.key === key) {
    const result = await pendingTokenRequest.promise;
    return result.accessToken;
  }

  const request: PendingTokenRequest = {
    key,
    promise: requestToken(domain, clientId, clientSecret),
  };
  pendingTokenRequest = request;
  try {
    const result = await request.promise;
    cachedToken = { key, ...result };
    return result.accessToken;
  } finally {
    if (pendingTokenRequest === request) pendingTokenRequest = null;
  }
}
