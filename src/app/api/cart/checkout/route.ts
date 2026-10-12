import { NextResponse } from "next/server";
import { readStoredCartId, clearStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getShopifyCart, getStorefrontMode } from "@/lib/storefront";
import { trustedCheckoutUrl } from "@/lib/cart-actions";

export const dynamic = "force-dynamic";

export async function POST() {
  if (getStorefrontMode() === "preview") return NextResponse.json({ error: "Purchases are disabled while the storefront is in preview mode." }, { status: 503 });
  try {
    const cartId = await readStoredCartId();
    if (!cartId) return NextResponse.json({ error: "Your bag is empty." }, { status: 409 });
    const cart = await getShopifyCart(cartId, await requestBuyerIp());
    if (!cart || cart.totalQuantity < 1) {
      await clearStoredCartId();
      return NextResponse.json({ error: "Your bag expired. Add your snacks again to continue." }, { status: 410 });
    }
    const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
    return NextResponse.json({ checkoutUrl: trustedCheckoutUrl(cart.checkoutUrl, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Shopify checkout is unavailable." }, { status: 502 });
  }
}
