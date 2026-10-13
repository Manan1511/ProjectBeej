import "server-only";
import { cookies } from "next/headers";
import { verifyTrackingContextCookie } from "@/lib/tracking-security";
import { getStoredCheckoutContext } from "@/lib/tracking-store";
import { TRACKING_CONTEXT_COOKIE, trackingSigningSecret } from "@/lib/tracking-secrets";

export { TRACKING_CONTEXT_COOKIE, trackingSigningSecret };

export async function readSignedTrackingContext() {
  try {
    const secret = trackingSigningSecret();
    const jar = await cookies();
    const token = jar.get(TRACKING_CONTEXT_COOKIE)?.value;
    if (!token) return null;
    const ids = verifyTrackingContextCookie(token, secret);
    if (!ids) return null;
    const context = await getStoredCheckoutContext(ids.contextId, ids.visitorId);
    return context ? { ...context, signedContextId: ids.contextId } : null;
  } catch {
    return null;
  }
}
