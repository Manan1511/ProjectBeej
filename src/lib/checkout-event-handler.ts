import { verifyConsentCapability } from "@/lib/tracking-security";
import { getCheckoutContextById, getCurrentVisitorConsent, recordCheckoutTrackingEvent } from "@/lib/tracking-store";
import { getTrackingProviderConfig } from "@/lib/tracking-server-config";
import { trackingSigningSecret } from "@/lib/tracking-secrets";
import { isAllowedCheckoutOrigin } from "@/lib/checkout-consent-handler";

const EVENT_MAP: Record<string, string> = {
  checkout_started: "begin_checkout",
  checkout_shipping_info_submitted: "add_shipping_info",
  payment_info_submitted: "add_payment_info",
  checkout_completed: "checkout_completed_diagnostic",
};

function response(origin: string | null, payload: unknown, status: number): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (isAllowedCheckoutOrigin(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "content-type");
    headers.set("Access-Control-Max-Age", "600");
    headers.set("Vary", "Origin");
  }
  return Response.json(payload, { status, headers });
}

export async function handleCheckoutTrackingEvent(request: Request): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!isAllowedCheckoutOrigin(origin)) return response(null, { error: "Invalid checkout origin." }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  } });
  if (request.method !== "POST") return response(origin, { error: "Method not allowed." }, 405);
  try {
    if (Number(request.headers.get("content-length") || 0) > 1200) return response(origin, { error: "Invalid checkout event." }, 413);
    const body = await request.json() as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => !["capability", "eventId", "name"].includes(key))) return response(origin, { error: "Invalid checkout event." }, 400);
    if (typeof body.capability !== "string" || body.capability.length > 256 || typeof body.eventId !== "string" || !/^[a-zA-Z0-9_-]{8,128}$/.test(body.eventId) || typeof body.name !== "string" || !EVENT_MAP[body.name]) return response(origin, { error: "Invalid checkout event." }, 400);

    const contextId = verifyConsentCapability(body.capability, trackingSigningSecret());
    if (!contextId) return response(origin, { error: "Checkout tracking context expired." }, 410);
    const context = await getCheckoutContextById(contextId);
    if (!context || context.consent.analytics !== true) return response(origin, { ok: false }, 200);
    const current = await getCurrentVisitorConsent(context.visitor_id);
    if (current?.analytics !== true) return response(origin, { ok: false }, 200);
    const config = getTrackingProviderConfig(process.env, process.env.CONTEXT);
    if (!config.ga4MeasurementId || !config.ga4ApiSecret) return response(origin, { ok: false }, 200);
    const clientId = context.identifiers.clientId;
    if (!clientId || !/^\d{1,20}\.\d{1,20}$/.test(clientId)) return response(origin, { ok: false }, 200);
    if (!await recordCheckoutTrackingEvent(contextId, body.eventId)) return response(origin, { ok: true, duplicate: true }, 200);
    const eventParams: Record<string, unknown> = { engagement_time_msec: 1, page_location: `${config.siteUrl}/checkout` };
    if (context.identifiers.sessionId && /^\d{1,20}$/.test(context.identifiers.sessionId)) eventParams.session_id = context.identifiers.sessionId;
    const lastTouch = context.attribution && typeof context.attribution.lastTouch === "object" && context.attribution.lastTouch ? context.attribution.lastTouch as Record<string, unknown> : null;
    if (lastTouch) {
      for (const [key, target] of [["utm_source", "campaign_source"], ["utm_medium", "campaign_medium"], ["utm_campaign", "campaign_name"], ["utm_id", "campaign_id"]] as const) {
        const value = lastTouch[key];
        if (typeof value === "string") eventParams[target] = value.slice(0, 100);
      }
    }
    const endpoint = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.ga4MeasurementId)}&api_secret=${encodeURIComponent(config.ga4ApiSecret)}`;
    const sent = await fetch(endpoint, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, events: [{ name: EVENT_MAP[body.name], params: eventParams }] }),
      cache: "no-store", signal: AbortSignal.timeout(5_000),
    });
    return response(origin, { ok: sent.ok }, sent.ok ? 200 : 503);
  } catch {
    return response(origin, { error: "Checkout tracking event could not be sent." }, 503);
  }
}
