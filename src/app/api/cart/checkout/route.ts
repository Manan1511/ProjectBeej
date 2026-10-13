import { NextResponse } from "next/server";
import { readStoredCartId, clearStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getFreshShopifyCheckoutUrl, getShopifyCart, getStorefrontMode } from "@/lib/storefront";
import { trustedCheckoutUrl } from "@/lib/cart-actions";
import { synchronizeCartTrackingAttributes } from "@/lib/checkout-context";

export const dynamic = "force-dynamic";

export async function POST() {
  if (getStorefrontMode() === "preview") return NextResponse.json({ error: "Purchases are disabled while the storefront is in preview mode." }, { status: 503 });
  try {
    const cartId = await readStoredCartId();
    if (!cartId) return NextResponse.json({ error: "Your bag is empty." }, { status: 409 });
    const buyerIp = await requestBuyerIp();
    const cart = await getShopifyCart(cartId, buyerIp);
    if (!cart || cart.totalQuantity < 1) {
      await clearStoredCartId();
      return NextResponse.json({ error: "Your bag expired. Add your snacks again to continue." }, { status: 410 });
    }
    const consent = await synchronizeCartTrackingAttributes(cartId, buyerIp);
    const checkoutUrl = await getFreshShopifyCheckoutUrl(cartId, consent, buyerIp);
    if (!checkoutUrl) return NextResponse.json({ error: "Shopify checkout could not be opened." }, { status: 502 });
    const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
    return NextResponse.json({ checkoutUrl: trustedCheckoutUrl(checkoutUrl, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shopify checkout is unavailable." }, { status: 502 });
  }
}
