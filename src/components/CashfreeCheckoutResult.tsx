"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCoordinator } from "@/components/cart-coordinator";

type ResultState = "checking" | "pending" | "processing" | "paid" | "failed" | "error";

export function CashfreeCheckoutResult({ orderId }: { orderId: string }) {
  const [state, setState] = useState<ResultState>("checking");
  const [orderName, setOrderName] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function check() {
      attempts += 1;
      try {
        const response = await fetch(`/api/payments/cashfree/status?order_id=${encodeURIComponent(orderId)}`, { cache: "no-store", credentials: "same-origin" });
        const result = await response.json() as { status?: ResultState; orderName?: string; message?: string; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setState("error");
          setMessage(result.error || "This payment session could not be matched. Check the Cashfree payment status before trying again.");
          return;
        }
        const next = result.status || "processing";
        setState(next);
        if (result.orderName) setOrderName(result.orderName);
        if (result.message) setMessage(result.message);
        if (next === "paid") {
          void cartCoordinator.refresh().catch(() => undefined);
          return;
        }
        if (next === "pending" || next === "processing") {
          timer = setTimeout(check, Math.min(2_500 * (2 ** Math.min(attempts - 1, 3)), 15_000));
        }
      } catch {
        if (cancelled) return;
        setState("processing");
        setMessage("Payment status is being checked with Cashfree and Shopify.");
        timer = setTimeout(check, Math.min(2_500 * (2 ** Math.min(attempts - 1, 3)), 15_000));
      }
    }

    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [orderId]);

  const heading = state === "paid" ? "Payment complete"
    : state === "failed" ? "Payment not completed"
      : state === "pending" ? "Payment is still pending"
        : state === "error" ? "We could not confirm this checkout"
          : "Checking your payment";
  const copy = state === "paid" ? `Your sandbox payment was verified${orderName ? ` and Shopify created test order ${orderName}` : ""}.`
    : state === "failed" ? "The payment did not complete. Your bag is still available."
      : state === "pending" ? "Cashfree has not confirmed a completed payment yet. Keep this page open while we check again."
        : state === "error" ? message
          : state === "processing" ? "Cashfree confirmed payment. Shopify is finishing the test order record. Do not pay again."
            : "Cashfree and Shopify are verifying your payment.";

  return <section className="cashfree-checkout-card cashfree-result-card" aria-live="polite">
    <div className={`cashfree-result-mark cashfree-result-${state}`} aria-hidden="true">{state === "paid" ? "✓" : state === "failed" ? "!" : "·"}</div>
    <h2>{heading}</h2>
    <p>{copy}</p>
    {message && state !== "error" ? <p className="checkout-note">{message}</p> : null}
    {state === "paid" ? <Link className="button button-dark" href="/shop">CONTINUE SHOPPING</Link>
      : state === "failed" || state === "error" ? <Link className="button button-dark" href="/cart">RETURN TO BAG</Link>
        : <p className="checkout-note">This page will continue checking automatically.</p>}
  </section>;
}
