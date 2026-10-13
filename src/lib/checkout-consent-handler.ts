import { createConsentCapability, verifyConsentCapability } from "@/lib/tracking-security";
import type { ConsentPreferences } from "@/lib/tracking-types";
import { reduceStoredConsent } from "@/lib/tracking-store";
import { trackingSigningSecret } from "@/lib/tracking-secrets";

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try { origins.add(new URL(siteUrl).origin); } catch { /* Invalid settings do not widen CORS. */ }
  }
  const shop = process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com";
  if (/^[-a-z0-9]+\.myshopify\.com$/i.test(shop)) origins.add(`https://${shop}`);
  for (const item of (process.env.SHOPIFY_CHECKOUT_ORIGINS || "").split(",")) {
    try {
      const parsed = new URL(item.trim());
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) origins.add(parsed.origin);
    } catch { /* Ignore malformed host entries. */ }
  }
  return origins;
}

export function isAllowedCheckoutOrigin(origin: string | null): origin is string {
  return Boolean(origin && allowedOrigins().has(origin));
}

function response(origin: string | null, body: unknown, status: number, headers: HeadersInit = {}) {
  const responseHeaders = new Headers({ "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers).entries()) });
  if (origin && allowedOrigins().has(origin)) {
    responseHeaders.set("Access-Control-Allow-Origin", origin);
    responseHeaders.set("Vary", "Origin");
  }
  return Response.json(body, { status, headers: responseHeaders });
}

export function createCheckoutConsentCapability(contextId: string): string {
  return createConsentCapability(contextId, trackingSigningSecret());
}

export async function handleCheckoutConsentRequest(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return response(null, { error: "Invalid checkout origin." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  } });
  if (request.method !== "POST") return response(origin, { error: "Method not allowed." }, 405, { Allow: "POST, OPTIONS" });
  try {
    if (Number(request.headers.get("content-length") || 0) > 2_000) return response(origin, { error: "Invalid consent update." }, 413);
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["capability", "consent"].includes(key))) {
      return response(origin, { error: "Invalid consent update." }, 400);
    }
    if (typeof body.capability !== "string" || body.capability.length > 256 || !body.consent || typeof body.consent !== "object" || Array.isArray(body.consent)) {
      return response(origin, { error: "Invalid consent update." }, 400);
    }
    const requested = body.consent as Record<string, unknown>;
    if (Object.keys(requested).length !== 3 || typeof requested.analytics !== "boolean" || typeof requested.marketing !== "boolean" || typeof requested.preferences !== "boolean") {
      return response(origin, { error: "Invalid consent update." }, 400);
    }
    const secret = trackingSigningSecret();
    const contextId = verifyConsentCapability(body.capability, secret);
    if (!contextId) return response(origin, { error: "Consent link expired. Refresh checkout from your bag." }, 410);
    const consent = requested as ConsentPreferences;
    const result = await reduceStoredConsent(contextId, consent);
    if (!result) return response(origin, { error: "Checkout can only reduce saved consent." }, 409);
    return response(origin, { ok: true }, 200);
  } catch {
    return response(origin, { error: "Checkout consent could not be synchronized." }, 503);
  }
}
