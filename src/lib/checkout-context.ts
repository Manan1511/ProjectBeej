import "server-only";
import type { ConsentPreferences } from "@/lib/tracking-types";
import { readSignedTrackingContext, trackingSigningSecret } from "@/lib/tracking-context-cookie";
import { buildCheckoutTrackingAttributes, mergeCheckoutAttributes } from "@/lib/tracking-cart-attributes";
import { createConsentCapability } from "@/lib/tracking-security";
import { getShopifyCartAttributes, updateShopifyCartAttributes } from "@/lib/storefront";

function noConsent(): ConsentPreferences {
  return { analytics: false, marketing: false, preferences: false };
}

export async function synchronizeCartTrackingAttributes(cartId: string, buyerIp?: string | null): Promise<ConsentPreferences> {
  const none = noConsent();
  const attempt = async (): Promise<ConsentPreferences> => {
    const context = await readSignedTrackingContext();
    if (!context) return none;
    const secret = trackingSigningSecret();
    const capability = createConsentCapability(context.context_id, secret);
    const trackingAttributes = buildCheckoutTrackingAttributes(context, capability);
    const existing = await getShopifyCartAttributes(cartId, buyerIp, 350);
    const result = await updateShopifyCartAttributes(cartId, mergeCheckoutAttributes(existing, trackingAttributes), buyerIp, 350);
    if (result.userErrors.length) return none;
    return context.consent;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      attempt(),
      new Promise<ConsentPreferences>((resolve) => { timer = setTimeout(() => resolve(none), 450); }),
    ]);
  } catch {
    return none;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
