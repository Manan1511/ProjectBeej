"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ShopifyCart } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { serializeCartWrite } from "@/components/cart-request";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";

async function readResponse(response: Response) {
  const data = await response.json() as { cart?: ShopifyCart; cartId?: string; acceptedQuantity?: number; removedQuantity?: number; error?: string; checkoutUrl?: string; warnings?: Array<{ message: string }> };
  if (!response.ok) throw new Error(data.error || "Shopify could not update your bag.");
  return data;
}

export function CartPanel({ initialCart, shippingConfigured }: { initialCart: ShopifyCart | null; shippingConfigured: boolean }) {
  const router = useRouter();
  const [cart, setCart] = useState(initialCart);
  const [busyLine, setBusyLine] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const viewedCart = useRef(false);

  useEffect(() => {
    if (viewedCart.current || !initialCart || initialCart.totalQuantity < 1) return;
    viewedCart.current = true;
    const items = initialCart.lines.flatMap((line) => {
      const item = createCommerceItem({ variantId: line.merchandise.id, title: line.merchandise.product.title, price: line.merchandise.price.amount, quantity: line.quantity, brand: "Project Beej", category: line.merchandise.product.productType, variant: line.merchandise.title });
      return item ? [item] : [];
    });
    if (items.length) emitCommerceEvent({ name: "view_cart", currency: initialCart.cost.subtotalAmount.currencyCode, value: Number(initialCart.cost.subtotalAmount.amount), items });
  }, [initialCart]);

  async function changeQuantity(lineId: string, quantity: number) {
    setBusyLine(lineId);
    setMessage("");
    try {
      const response = await serializeCartWrite(() => fetch("/api/cart/lines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineId, quantity }) }));
      const data = await readResponse(response);
      const previous = cart?.lines.find((line) => line.id === lineId);
      if (previous && (data.acceptedQuantity || data.removedQuantity)) {
        const added = (data.acceptedQuantity || 0) > 0;
        const amount = added ? data.acceptedQuantity! : data.removedQuantity!;
        const item = createCommerceItem({ variantId: previous.merchandise.id, title: previous.merchandise.product.title, price: previous.merchandise.price.amount, quantity: amount, brand: "Project Beej", category: previous.merchandise.product.productType, variant: previous.merchandise.title });
        const shopifyProduct = createShopifyAnalyticsProduct({ productGid: previous.merchandise.product.id, variantGid: previous.merchandise.id, name: previous.merchandise.product.title, variantName: previous.merchandise.title, brand: "Project Beej", category: previous.merchandise.product.productType, price: previous.merchandise.price.amount, quantity: amount });
        if (item) emitCommerceEvent({ name: added ? "add_to_cart" : "remove_from_cart", currency: previous.merchandise.price.currencyCode, value: Number(previous.merchandise.price.amount) * amount, items: [item] }, added ? { shopifyCartId: cart?.id, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) } : {});
      }
      setCart(data.cart || null);
      router.refresh();
      if (data.warnings?.length) setMessage(data.warnings.map((warning) => warning.message).join(" "));
    } catch (error) { emitCommerceEvent({ name: "commerce_error", action: "cart_update" }); setMessage(error instanceof Error ? error.message : "Bag update failed."); }
    finally { setBusyLine(null); }
  }

  async function removeLine(lineId: string) {
    setBusyLine(lineId);
    setMessage("");
    try {
      const response = await serializeCartWrite(() => fetch(`/api/cart/lines?lineId=${encodeURIComponent(lineId)}`, { method: "DELETE" }));
      const data = await readResponse(response);
      const removed = cart?.lines.find((line) => line.id === lineId);
      if (removed) {
        const item = createCommerceItem({ variantId: removed.merchandise.id, title: removed.merchandise.product.title, price: removed.merchandise.price.amount, quantity: data.removedQuantity || removed.quantity, brand: "Project Beej", category: removed.merchandise.product.productType, variant: removed.merchandise.title });
        if (item) emitCommerceEvent({ name: "remove_from_cart", currency: removed.merchandise.price.currencyCode, value: Number(removed.merchandise.price.amount) * (data.removedQuantity || removed.quantity), items: [item] });
      }
      setCart(data.cart || null);
      router.refresh();
    } catch (error) { emitCommerceEvent({ name: "commerce_error", action: "cart_update" }); setMessage(error instanceof Error ? error.message : "Bag update failed."); }
    finally { setBusyLine(null); }
  }

  async function checkout() {
    setCheckingOut(true);
    setMessage("");
    try {
      const response = await fetch("/api/cart/checkout", { method: "POST" });
      const data = await readResponse(response);
      if (!data.checkoutUrl) throw new Error("Shopify checkout could not be opened.");
      const checkoutCart = cart;
      if (checkoutCart) {
        const items = checkoutCart.lines.flatMap((line) => {
          const item = createCommerceItem({ variantId: line.merchandise.id, title: line.merchandise.product.title, price: line.merchandise.price.amount, quantity: line.quantity, brand: "Project Beej", category: line.merchandise.product.productType, variant: line.merchandise.title });
          return item ? [item] : [];
        });
        if (items.length) emitCommerceEvent({ name: "begin_checkout", currency: checkoutCart.cost.subtotalAmount.currencyCode, value: Number(checkoutCart.cost.subtotalAmount.amount), items });
      }
      window.location.assign(data.checkoutUrl);
    } catch (error) {
      emitCommerceEvent({ name: "commerce_error", action: "checkout" });
      setMessage(error instanceof Error ? error.message : "Shopify checkout is unavailable.");
      setCheckingOut(false);
    }
  }

  if (!cart || cart.totalQuantity === 0) {
    return <div className="empty-cart">
      <Image src="/assets/squad-runner-hq.png" alt="" width={120} height={120} />
      <p className="eyebrow">Good things start small</p>
      <h2>Your bag is empty</h2>
      <p>Every great habit starts with a single seed.</p>
      <Link href="/shop" className="button button-dark">Start shopping</Link>
      <p className="form-message" aria-live="polite">{message}</p>
    </div>;
  }

  return (
    <div className="cart-layout">
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
                  <button type="button" onClick={() => changeQuantity(line.id, line.quantity - 1)} disabled={busyLine === line.id || line.quantity <= 1} aria-label="Decrease quantity">−</button>
                  <span aria-live="polite">{line.quantity}</span>
                  <button type="button" onClick={() => changeQuantity(line.id, line.quantity + 1)} disabled={busyLine === line.id || cart.totalQuantity >= 10} aria-label="Increase quantity">+</button>
                </div>
                <button className="remove-link" type="button" onClick={() => removeLine(line.id)} disabled={busyLine === line.id}>Remove</button>
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
        <div className="summary-row"><span>Subtotal ({cart.totalQuantity})</span><strong>{formatINR(cart.cost.subtotalAmount.amount)}</strong></div>
        <div className="summary-row"><span>Shipping</span><strong>At checkout</strong></div>
        <div className="summary-row summary-total"><span>Order total</span><strong>{formatINR(cart.cost.totalAmount.amount)}*</strong></div>
        <p className="tax-note">*Shopify confirms taxes and delivery charges in the secure checkout.</p>
        <button className="button button-sage checkout-button" type="button" onClick={checkout} disabled={checkingOut}>{checkingOut ? "Opening checkout…" : "Checkout securely"}</button>
        <p className="checkout-note">Online payment and order confirmation are handled by Shopify.</p>
        <p className="form-message" role="status">{message}</p>
      </aside>
    </div>
  );
}
