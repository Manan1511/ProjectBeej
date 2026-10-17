import type { Metadata } from "next";
import { CartPanel } from "@/components/CartPanel";

export const metadata: Metadata = { title: "Your bag", description: "Review your Project Beej snacks before secure checkout.", robots: { index: false, follow: false } };

export default function CartPage() {
  const shippingConfigured = process.env.SHOPIFY_SHIPPING_CONFIGURED === "1";
  return <main id="main-content" className="cart-page artifact-cart-page"><div className="cart-title-row"><h1>Your bag</h1><div className="checkout-steps"><span className="step-active">1 · BAG</span><span>2 · DETAILS</span><span>3 · DONE</span></div></div><CartPanel shippingConfigured={shippingConfigured} /></main>;
}
