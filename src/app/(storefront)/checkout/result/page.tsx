import type { Metadata } from "next";
import { CashfreeCheckoutResult } from "@/components/CashfreeCheckoutResult";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment status",
  description: "Check your Project Beej payment status.",
  robots: { index: false, follow: false },
};

export default async function CheckoutResultPage({ searchParams }: { searchParams: Promise<{ order_id?: string }> }) {
  const { order_id: orderId = "" } = await searchParams;
  const safeOrderId = /^beej_[a-f0-9]{32}$/.test(orderId) ? orderId : "invalid";
  return <main id="main-content" className="cart-page cashfree-checkout-page">
    <div className="cart-title-row"><div><p className="eyebrow">PROJECT BEEJ</p><h1>Order status</h1></div><div className="checkout-steps"><span>1 · BAG</span><span>2 · DETAILS</span><span className="step-active">3 · DONE</span></div></div>
    <CashfreeCheckoutResult orderId={safeOrderId} />
  </main>;
}
