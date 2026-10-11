import type { Metadata } from "next";
import { CartPanel } from "@/components/CartPanel";
import { readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getShopifyCart } from "@/lib/storefront";

export const metadata: Metadata = { title: "Your bag", description: "Review your Project Beej snacks before secure checkout." };

export default async function CartPage() {
  let cart = null;
  try {
    const cartId = await readStoredCartId();
    if (cartId) cart = await getShopifyCart(cartId, await requestBuyerIp());
  } catch { cart = null; }
  const shippingConfigured = process.env.SHOPIFY_SHIPPING_CONFIGURED === "1";
  return <main id="main-content" className="cart-page"><div className="cart-title-row"><div><span className="eyebrow">One good choice at a time</span><h1>Your bag.</h1></div><div className="checkout-steps"><span className="step-active">1 · Bag</span><span>2 · Details</span><span>3 · Done</span></div></div><CartPanel initialCart={cart} shippingConfigured={shippingConfigured} /></main>;
}
