import { isIP } from "node:net";
import { parseTrackingContextInput } from "@/lib/tracking-context-validation";
import { createTrackingContextCookie, verifyTrackingContextCookie } from "@/lib/tracking-security";
import { storeTrackingContext } from "@/lib/tracking-store";
import { TRACKING_CONTEXT_COOKIE, trackingSigningSecret } from "@/lib/tracking-secrets";

const MAX_CONTEXT_BYTES = 12_000;
const COOKIE_AGE = 180 * 24 * 60 * 60;

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers).entries()) } });
}

export async function handleTrackingContextRequest(request: Request, trustedClientIp?: string): Promise<Response> {
  let requestOrigin: string;
  try { requestOrigin = new URL(request.url).origin; } catch { return json({ error: "Invalid request origin." }, 400); }
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== requestOrigin) return json({ error: "Invalid request origin." }, 403);
  } catch { return json({ error: "Invalid request origin." }, 403); }
  if (Number(request.headers.get("content-length") || 0) > MAX_CONTEXT_BYTES) return json({ error: "Tracking context is too large." }, 413);

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_CONTEXT_BYTES) return json({ error: "Tracking context is too large." }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid tracking context." }, 400); }
    const context = parseTrackingContextInput(body, requestOrigin);
    if (!context) return json({ error: "Invalid tracking context." }, 400);

    const secret = trackingSigningSecret();
    const currentToken = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${TRACKING_CONTEXT_COOKIE}=`))?.slice(TRACKING_CONTEXT_COOKIE.length + 1) || "";
    const current = verifyTrackingContextCookie(decodeCookie(currentToken), secret);
    const visitorId = current?.visitorId || crypto.randomUUID();
    const contextId = crypto.randomUUID();
    const safeIp = context.consent.marketing && trustedClientIp && isIP(trustedClientIp) ? trustedClientIp : undefined;
    await storeTrackingContext({
      visitorId,
      contextId,
      context,
      ...(safeIp ? { clientIp: safeIp } : {}),
      ...(context.consent.marketing ? { userAgent: request.headers.get("user-agent") || undefined } : {}),
    });

    const token = createTrackingContextCookie(visitorId, contextId, secret);
    const secure = new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
    const setCookie = `${TRACKING_CONTEXT_COOKIE}=${encodeURIComponent(token)}; Max-Age=${COOKIE_AGE}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    return json({ ok: true }, 200, { "Set-Cookie": setCookie });
  } catch {
    return json({ error: "Tracking consent could not be synchronized." }, 503);
  }
}

function decodeCookie(value: string): string {
  try { return decodeURIComponent(value); } catch { return ""; }
}
