"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ShopifyCart } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { cartCoordinator, useCartSnapshot } from "@/components/cart-coordinator";
import { createCommerceItem, emitCommerceEvent } from "@/lib/tracking-client";

async function readResponse(response: Response) {
  const data = await response.json() as { error?: string; checkoutUrl?: string };
  if (!response.ok) throw new Error(data.error || "Shopify could not update your bag.");
  return data;
}

function reportCartView(cart: ShopifyCart) {
  const items = cart.lines.flatMap((line) => {
    const item = createCommerceItem({ variantId: line.merchandise.id, title: line.merchandise.product.title, price: line.merchandise.price.amount, quantity: line.quantity, brand: "Project Beej", category: line.merchandise.product.productType, variant: line.merchandise.title });
    return item ? [item] : [];
  });
  if (items.length) emitCommerceEvent({ name: "view_cart", currency: cart.cost.subtotalAmount.currencyCode, value: Number(cart.cost.subtotalAmount.amount), items });
}

export function CartPanel({ shippingConfigured }: { shippingConfigured: boolean }) {
  const snapshot = useCartSnapshot();
  const cart = snapshot.cart;
  const confirmedCart = snapshot.confirmedCart;
  const [checkingOut, setCheckingOut] = useState(false);
  const [localMessage, setLocalMessage] = useState("");
  const viewedCart = useRef(false);

  useEffect(() => {
    if (viewedCart.current || !snapshot.loaded || !confirmedCart || confirmedCart.totalQuantity < 1) return;
    viewedCart.current = true;
    reportCartView(confirmedCart);
  }, [confirmedCart, snapshot.loaded]);

  async function checkout() {
    setCheckingOut(true);
    setLocalMessage("");
    try {
      await cartCoordinator.flush();
      const checkoutCart = cartCoordinator.getSnapshot().confirmedCart;
      if (!checkoutCart || checkoutCart.totalQuantity < 1) throw new Error("Your bag is empty.");
      const response = await fetch("/api/cart/checkout", { method: "POST", cache: "no-store" });
      const data = await readResponse(response);
      if (!data.checkoutUrl) throw new Error("Shopify checkout could not be opened.");
      const items = checkoutCart.lines.flatMap((line) => {
        const item = createCommerceItem({ variantId: line.merchandise.id, title: line.merchandise.product.title, price: line.merchandise.price.amount, quantity: line.quantity, brand: "Project Beej", category: line.merchandise.product.productType, variant: line.merchandise.title });
        return item ? [item] : [];
      });
      if (items.length) emitCommerceEvent({ name: "begin_checkout", currency: checkoutCart.cost.subtotalAmount.currencyCode, value: Number(checkoutCart.cost.subtotalAmount.amount), items });
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      emitCommerceEvent({ name: "commerce_error", action: "checkout" });
      setLocalMessage(error instanceof Error ? error.message : "Shopify checkout is unavailable.");
      setCheckingOut(false);
    }
  }

  const message = localMessage || snapshot.message;
  if (!snapshot.loaded && !cart && !message) {
    return <div className="empty-cart artifact-cart-empty" role="status" aria-busy="true"><p>Loading your bag…</p></div>;
  }
  if (!snapshot.loaded && message && !cart) {
    return <div className="empty-cart artifact-cart-empty" role="alert"><h2>Your bag could not load</h2><p>{message}</p><button className="button button-dark" type="button" onClick={() => { setLocalMessage(""); void cartCoordinator.refresh().catch(() => undefined); }}>TRY AGAIN</button></div>;
  }
  if (!cart || cart.totalQuantity === 0) {
    return <div className="empty-cart artifact-cart-empty">
      <Image src="/assets/squad-runner-hq.png" alt="" width={120} height={120} />
      <h2>Your bag is empty</h2>
      <p>Every great habit starts with a single seed.</p>
      <Link href="/shop" className="button button-dark">START SHOPPING</Link>
      <p className="form-message" aria-live="polite" hidden={!message}>{message}</p>
    </div>;
  }

  const estimatedSubtotal = cart.lines.reduce((sum, line) => sum + Number(line.merchandise.price.amount) * line.quantity, 0);
  const shownSubtotal = snapshot.pending ? estimatedSubtotal : confirmedCart?.cost.subtotalAmount.amount || cart.cost.subtotalAmount.amount;
  const shownTotal = snapshot.pending ? estimatedSubtotal : confirmedCart?.cost.totalAmount.amount || cart.cost.totalAmount.amount;

  return (
    <div className="cart-layout artifact-cart-filled" aria-busy={snapshot.pending}>
      <div className="cart-list">
        {cart.lines.map((line) => (
          <article className="cart-line" key={line.id}>
            <Link className="cart-thumb" href={`/products/${line.merchandise.product.handle}`}>
              <Image src={line.merchandise.product.featuredImage?.url || "/assets/seed.png"} alt={line.merchandise.product.featuredImage?.alt || line.merchandise.product.title} fill sizes="100px" />
            </Link>
            <div className="cart-line-copy">
              <span className="eyebrow">{line.merchandise.product.productType}</span>
              <Link href={`/products/${line.merchandise.product.handle}`} className="cart-line-title">{line.merchandise.product.title}</Link>
              {line.merchandise.title !== "Default Title" ? <span className="cart-line-variant">{line.merchandise.title}</span> : null}
              <span className="cart-line-unit">{formatINR(line.merchandise.price.amount)} each</span>
              <div className="cart-line-actions">
                <div className="quantity-stepper" aria-label={`Quantity for ${line.merchandise.product.title}`}>
                  <button type="button" onClick={() => cartCoordinator.adjustQuantity(line.merchandise.id, -1)} disabled={checkingOut || line.quantity <= 1} aria-label="Decrease quantity">−</button>
                  <span aria-live="polite">{line.quantity}</span>
                  <button type="button" onClick={() => cartCoordinator.adjustQuantity(line.merchandise.id, 1)} disabled={checkingOut || cart.totalQuantity >= 10 || line.quantity >= 10} aria-label="Increase quantity">+</button>
                </div>
                <button className="remove-link" type="button" onClick={() => cartCoordinator.setQuantity(line.merchandise.id, 0)} disabled={checkingOut}>Remove</button>
              </div>
            </div>
            <span className="cart-line-total">{formatINR(Number(line.merchandise.price.amount) * line.quantity)}</span>
          </article>
        ))}
        <Link className="text-link keep-shopping" href="/shop">← Keep shopping</Link>
      </div>
      <aside className="cart-summary">
        <p className="eyebrow">Your Beej bag</p>
        <h2>Summary</h2>
        {shippingConfigured ? <div className="ship-note">Shipping rates configured in Shopify. Final delivery cost appears at checkout.</div> : <div className="ship-note">Shipping is calculated in Shopify checkout.</div>}
        <div className="summary-row"><span>{snapshot.pending ? "Estimated subtotal" : "Subtotal"} ({cart.totalQuantity})</span><strong>{formatINR(shownSubtotal)}</strong></div>
        <div className="summary-row"><span>Shipping</span><strong>At checkout</strong></div>
        <div className="summary-row summary-total"><span>{snapshot.pending ? "Estimated total" : "Order total"}</span><strong>{formatINR(shownTotal)}*</strong></div>
        <p className="tax-note">*Shopify confirms taxes and delivery charges in the secure checkout.</p>
        <button className="button button-sage checkout-button" type="button" onClick={checkout} disabled={checkingOut}>{checkingOut ? "Opening checkout…" : "Checkout securely"}</button>
        <p className="checkout-note">Online payment and order confirmation are handled by Shopify.</p>
        <p className="form-message" role="status">{message}</p>
      </aside>
    </div>
  );
}
