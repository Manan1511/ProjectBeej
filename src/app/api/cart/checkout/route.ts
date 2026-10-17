import { NextResponse } from "next/server";
import { readStoredCartId, clearStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getFreshShopifyCheckoutUrl, getShopifyCart, getStorefrontMode } from "@/lib/storefront";
import { trustedCheckoutUrl } from "@/lib/cart-actions";
import { synchronizeCartTrackingAttributes } from "@/lib/checkout-context";
import { withKeyedLock } from "@/lib/lock";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST() {
  if (getStorefrontMode() === "preview") return privateJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  try {
    const cartId = await readStoredCartId();
    if (!cartId) return privateJson({ error: "Your bag is empty." }, 409);
    return await withKeyedLock(`cart:${cartId}`, async () => {
      const buyerIp = await requestBuyerIp();
      const cart = await getShopifyCart(cartId, buyerIp);
      if (!cart || cart.totalQuantity < 1) {
        await clearStoredCartId();
        return privateJson({ error: "Your bag expired. Add your snacks again to continue." }, 410);
      }
      const consent = await synchronizeCartTrackingAttributes(cartId, buyerIp);
      const checkoutUrl = await getFreshShopifyCheckoutUrl(cartId, consent, buyerIp);
      if (!checkoutUrl) return privateJson({ error: "Shopify checkout could not be opened." }, 502);
      const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
      return privateJson({ checkoutUrl: trustedCheckoutUrl(checkoutUrl, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts) });
    });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Shopify checkout is unavailable." }, 502);
  }
}
