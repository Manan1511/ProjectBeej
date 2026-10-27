import type { Metadata } from "next";
import { CashfreeCheckout } from "@/components/CashfreeCheckout";
import { cashfreeCheckoutConfigured, type CashfreeCheckoutSource } from "@/lib/cashfree-core";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Secure checkout",
  description: "Complete your Project Beej order.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const params = await searchParams;
  const source: CashfreeCheckoutSource = params.source === "buy-now" ? "buy-now" : "bag";
  const enabled = cashfreeCheckoutConfigured();
  return <main id="main-content" className="cart-page cashfree-checkout-page">
    <div className="cart-title-row"><div><p className="eyebrow">PROJECT BEEJ</p><h1>Checkout</h1></div><div className="checkout-steps"><span>1 · BAG</span><span className="step-active">2 · DETAILS</span><span>3 · DONE</span></div></div>
    <CashfreeCheckout enabled={enabled} source={source} />
  </main>;
}
