"use client";

import Script from "next/script";
import Link from "next/link";
import { useMemo, useRef, useState, type FormEvent } from "react";
import type { CashfreeCheckoutSource } from "@/lib/cashfree-core";

type DeliveryOption = { handle: string; title: string; description: string | null; amount: string; currencyCode: string };
type DeliveryGroup = { id: string; options: DeliveryOption[] };
type DeliverySelection = { deliveryGroupId: string; deliveryOptionHandle: string };
type Buyer = { firstName: string; lastName: string; email: string; phone: string };
type Address = { address1: string; address2: string; city: string; province: string; zip: string };
type Quote = { amount: string; currencyCode: string };

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: "_self" }) => Promise<{ error?: { message?: string } } | void>;
    };
  }
}

const money = (amount: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount));

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Checkout could not be prepared.");
  return data;
}

export function CashfreeCheckout({ enabled, source }: { enabled: boolean; source: CashfreeCheckoutSource }) {
  const [sdkReady, setSdkReady] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>({ firstName: "", lastName: "", email: "", phone: "" });
  const [address, setAddress] = useState<Address>({ address1: "", address2: "", city: "", province: "", zip: "" });
  const [groups, setGroups] = useState<DeliveryGroup[]>([]);
  const [selections, setSelections] = useState<DeliverySelection[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const attemptId = useRef<string | null>(null);
  const selectedCount = useMemo(() => selections.filter((item) => item.deliveryOptionHandle).length, [selections]);

  function updateBuyer(key: keyof Buyer, value: string) {
    setBuyer((current) => ({ ...current, [key]: value }));
    attemptId.current = null;
    setQuote(null);
    setGroups([]);
    setSelections([]);
  }

  function updateAddress(key: keyof Address, value: string) {
    setAddress((current) => ({ ...current, [key]: value }));
    attemptId.current = null;
    setQuote(null);
    setGroups([]);
    setSelections([]);
  }

  function checkoutBody(deliverySelections?: DeliverySelection[]) {
    return {
      source,
      buyer,
      address,
      ...(deliverySelections ? { deliverySelections } : {}),
    };
  }

  async function getDeliveryOptions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    attemptId.current = null;
    setBusy(true);
    setMessage("");
    setQuote(null);
    try {
      const result = await postJson("/api/payments/cashfree/shipping-options", checkoutBody()) as { groups?: DeliveryGroup[] };
      const nextGroups = result.groups || [];
      if (!nextGroups.length || nextGroups.some((group) => !group.options.length)) throw new Error("No delivery methods are available for this address.");
      const defaultSelections = nextGroups.map((group) => ({ deliveryGroupId: group.id, deliveryOptionHandle: group.options[0]!.handle }));
      const selected = await postJson("/api/payments/cashfree/shipping-options", checkoutBody(defaultSelections)) as { total?: Quote };
      setGroups(nextGroups);
      setSelections(defaultSelections);
      if (selected.total?.currencyCode === "INR") setQuote(selected.total);
      else throw new Error("Shopify could not calculate a delivery total.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Delivery options could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  function updateSelection(groupId: string, handle: string) {
    attemptId.current = null;
    setSelections((current) => current.map((selection) => selection.deliveryGroupId === groupId ? { ...selection, deliveryOptionHandle: handle } : selection));
    setQuote(null);
  }

  async function updateTotal() {
    setBusy(true);
    setMessage("");
    try {
      const selected = await postJson("/api/payments/cashfree/shipping-options", checkoutBody(selections)) as { total?: Quote };
      if (!selected.total || selected.total.currencyCode !== "INR") throw new Error("Shopify could not calculate a delivery total.");
      setQuote(selected.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The delivery total could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    if (!quote || !sdkReady || !window.Cashfree) return;
    setBusy(true);
    setMessage("");
    try {
      if (!attemptId.current) attemptId.current = crypto.randomUUID();
      const result = await postJson("/api/payments/cashfree/create-order", {
        ...checkoutBody(selections),
        attemptId: attemptId.current,
      }) as { orderId?: string; paymentSessionId?: string; mode?: string };
      if (result.mode !== "sandbox" || !result.orderId || !result.paymentSessionId) throw new Error("Cashfree did not return a valid sandbox payment session.");
      const cashfree = window.Cashfree({ mode: "sandbox" });
      const checkoutResult = await cashfree.checkout({ paymentSessionId: result.paymentSessionId, redirectTarget: "_self" });
      if (checkoutResult?.error) throw new Error(checkoutResult.error.message || "Cashfree could not open checkout.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cashfree checkout could not be opened.");
      setBusy(false);
    }
  }

  if (!enabled) return <section className="cashfree-checkout-card"><h2>Sandbox checkout is not set up yet</h2><p>Add the Cashfree test credentials and required Shopify Admin access in the server environment. Your existing Shopify checkout is still available.</p><Link className="button button-dark" href={source === "buy-now" ? "/shop" : "/cart"}>RETURN TO {source === "buy-now" ? "SHOP" : "BAG"}</Link></section>;

  return (
    <>
      <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onReady={() => setSdkReady(true)} onError={() => setMessage("Cashfree checkout could not load. Check your connection and try again.")} />
      <section className="cashfree-checkout-card">
        <div className="cashfree-sandbox-label">CASHFREE SANDBOX TEST</div>
        <p className="checkout-note">This test checkout will not collect a real payment. Any completed payment creates a Shopify test order and does not reserve inventory.</p>
        <form className="cashfree-checkout-form" onSubmit={getDeliveryOptions}>
          <h2>Contact and delivery</h2>
          <div className="cashfree-form-grid">
            <label>First name<input required autoComplete="given-name" maxLength={80} value={buyer.firstName} onChange={(event) => updateBuyer("firstName", event.target.value)} /></label>
            <label>Last name<input required autoComplete="family-name" maxLength={80} value={buyer.lastName} onChange={(event) => updateBuyer("lastName", event.target.value)} /></label>
            <label>Email<input required type="email" autoComplete="email" maxLength={254} value={buyer.email} onChange={(event) => updateBuyer("email", event.target.value)} /></label>
            <label>Mobile number<input required type="tel" inputMode="tel" autoComplete="tel-national" maxLength={18} placeholder="10-digit mobile number" value={buyer.phone} onChange={(event) => updateBuyer("phone", event.target.value)} /></label>
            <label className="cashfree-form-wide">Address line 1<input required autoComplete="address-line1" maxLength={200} value={address.address1} onChange={(event) => updateAddress("address1", event.target.value)} /></label>
            <label className="cashfree-form-wide">Address line 2 <span>(optional)</span><input autoComplete="address-line2" maxLength={200} value={address.address2} onChange={(event) => updateAddress("address2", event.target.value)} /></label>
            <label>City<input required autoComplete="address-level2" maxLength={100} value={address.city} onChange={(event) => updateAddress("city", event.target.value)} /></label>
            <label>State<input required autoComplete="address-level1" maxLength={100} value={address.province} onChange={(event) => updateAddress("province", event.target.value)} /></label>
            <label>PIN code<input required inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[0-9]{6}" value={address.zip} onChange={(event) => updateAddress("zip", event.target.value)} /></label>
          </div>
          <button className="button button-outline" type="submit" disabled={busy}>{busy ? "Checking delivery…" : "CHECK DELIVERY OPTIONS"}</button>
        </form>

        {groups.length ? <div className="cashfree-delivery-options">
          <h2>Delivery method</h2>
          {groups.map((group, index) => <label key={group.id}>Delivery option {groups.length > 1 ? index + 1 : ""}<select value={selections.find((item) => item.deliveryGroupId === group.id)?.deliveryOptionHandle || ""} onChange={(event) => updateSelection(group.id, event.target.value)}>
            {group.options.map((option) => <option key={option.handle} value={option.handle}>{option.title} · {money(option.amount)}</option>)}
          </select>{group.options.find((option) => option.handle === selections.find((item) => item.deliveryGroupId === group.id)?.deliveryOptionHandle)?.description ? <small>{group.options.find((option) => option.handle === selections.find((item) => item.deliveryGroupId === group.id)?.deliveryOptionHandle)?.description}</small> : null}</label>)}
          <button className="text-link" type="button" onClick={updateTotal} disabled={busy || selectedCount !== groups.length}>{busy ? "Updating…" : "UPDATE ORDER TOTAL"}</button>
          {quote ? <div className="cashfree-total-row"><span>Shopify calculated total</span><strong>{money(quote.amount)}</strong></div> : null}
          <button className="button button-sage" type="button" onClick={pay} disabled={busy || !quote || !sdkReady}>{busy ? "Preparing payment…" : sdkReady ? "PAY WITH CASHFREE SANDBOX" : "LOADING SECURE CHECKOUT…"}</button>
        </div> : null}
        <p className="form-message" role="alert">{message}</p>
        <Link href={source === "buy-now" ? "/shop" : "/cart"} className="text-link">← Return to {source === "buy-now" ? "shop" : "bag"}</Link>
      </section>
    </>
  );
}
