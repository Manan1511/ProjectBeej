import type { Metadata } from "next";
import { CartPanel } from "@/components/CartPanel";
import { readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getShopifyCart } from "@/lib/storefront";
import { toPublicShopifyCart } from "@/lib/commerce";

export const metadata: Metadata = { title: "Your bag", description: "Review your Project Beej snacks before secure checkout.", robots: { index: false, follow: false } };

export default async function CartPage() {
  let cart = null;
  try {
    const cartId = await readStoredCartId();
    if (cartId) {
      const stored = await getShopifyCart(cartId, await requestBuyerIp());
      cart = stored ? toPublicShopifyCart(stored) : null;
    }
  } catch { cart = null; }
  const shippingConfigured = process.env.SHOPIFY_SHIPPING_CONFIGURED === "1";
  return <main id="main-content" className="cart-page artifact-cart-page"><div className="cart-title-row"><h1>Your bag</h1><div className="checkout-steps"><span className="step-active">1 · BAG</span><span>2 · DETAILS</span><span>3 · DONE</span></div></div><CartPanel initialCart={cart} shippingConfigured={shippingConfigured} /></main>;
}
