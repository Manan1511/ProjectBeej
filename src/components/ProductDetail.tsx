"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BeejProduct, ProductFaq, ProductReview } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";
import { cartCoordinator, describeProductVariant, useCartSnapshot } from "@/components/cart-coordinator";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";
import { variantIdFromSearch } from "@/lib/product-variant";

const fallbackSkins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

async function postAction(url: string, variantId: string, quantity: number) {
  const queueKey = url === "/api/buy-now" ? "buy-now" : "bag";
  const response = await serializeCartWrite(() => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity, clientKey: getBrowserCartKey() }) }), queueKey);
  const data = await response.json() as { error?: string; checkoutUrl?: string; cartId?: string; cart?: { totalQuantity: number }; acceptedQuantity?: number; warnings?: Array<{ message: string }> };
  if (!response.ok) throw Object.assign(new Error(data.error || "That snack could not be added right now."), { status: response.status });
  return data;
}

export function ProductDetail({ product, faqs, reviews }: { product: BeejProduct; faqs: ProductFaq[]; reviews: ProductReview[] }) {
  const skin = fallbackSkins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: "A Beej original" };
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.availableForSale)?.id || product.variants[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [buyingNow, setBuyingNow] = useState(false);
  const [message, setMessage] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const viewedProduct = useRef("");
  const cartSnapshot = useCartSnapshot();
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) || product.variants[0], [product.variants, variantId]);
  const price = variant?.price || product.price;
  const available = !product.preview && Boolean(variant?.availableForSale);

  useEffect(() => {
    const syncVariantFromUrl = () => {
      const match = variantIdFromSearch(product.variants, window.location.search);
      if (match) setVariantId(match);
    };
    syncVariantFromUrl();
    window.addEventListener("popstate", syncVariantFromUrl);
    return () => window.removeEventListener("popstate", syncVariantFromUrl);
  }, [product.variants]);

  useEffect(() => {
    if (!variant || viewedProduct.current === product.id) return;
    viewedProduct.current = product.id;
    const item = createCommerceItem({ variantId: variant.id, title: product.title, price: variant.price.amount, brand: "Project Beej", category: product.productType, variant: variant.title });
    if (item) emitCommerceEvent({ name: "view_item", currency: variant.price.currencyCode, value: Number(variant.price.amount), items: [item] });
  }, [product, variant]);

  async function addToBag(buyNow: boolean) {
    if (!variant || !available) return;
    setMessage("");
    if (!buyNow) {
      const acceptedLocally = cartCoordinator.adjustQuantity(variant.id, quantity, describeProductVariant(product, variant));
      setMessage(acceptedLocally ? "Added to your bag." : cartCoordinator.getSnapshot().message || "Your bag could not be updated.");
      return;
    }

    setBuyingNow(true);
    try {
      const result = await postAction("/api/buy-now", variant.id, quantity);
      const acceptedQuantity = result.acceptedQuantity || 0;
      const item = createCommerceItem({ variantId: variant.id, title: product.title, price: variant.price.amount, quantity: acceptedQuantity, brand: "Project Beej", category: product.productType, variant: variant.title });
      const shopifyProduct = createShopifyAnalyticsProduct({ productGid: product.id, variantGid: variant.id, name: product.title, variantName: variant.title, brand: "Project Beej", category: product.productType, price: variant.price.amount, quantity: acceptedQuantity });
      if (acceptedQuantity > 0 && item) emitCommerceEvent({ name: "add_to_cart", currency: variant.price.currencyCode, value: Number(variant.price.amount) * acceptedQuantity, items: [item] }, { shopifyCartId: result.cartId, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) });
      if (buyNow && result.checkoutUrl) {
        if (acceptedQuantity > 0 && item) emitCommerceEvent({ name: "begin_checkout", currency: variant.price.currencyCode, value: Number(variant.price.amount) * acceptedQuantity, items: [item] });
        window.location.assign(result.checkoutUrl);
      }
      else setMessage(result.warnings?.map((warning) => warning.message).join(" ") || "Shopify could not open checkout.");
    } catch (error) {
      emitCommerceEvent({ name: "commerce_error", action: "buy_now", ...(typeof (error as { status?: unknown })?.status === "number" ? { status_code: (error as { status: number }).status } : {}) });
      setMessage(error instanceof Error ? error.message : "That snack could not be added right now.");
    }
    finally { setBuyingNow(false); }
  }

  return (
    <>
      <div className="product-page artifact-product-shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span>/</span><Link href={product.productType === "Ready to Roast" ? "/collections/ready-to-roast" : "/collections/roasted-makhana"}>{product.productType}</Link><span>/</span><span aria-current="page">{product.title}</span></nav>
        <div className="product-detail-grid artifact-product-layout">
          <div className="product-gallery">
            <div className="product-main-image" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
              {product.images[activeImage] ? <Image src={product.images[activeImage].url} alt={product.images[activeImage].alt} fill sizes="(max-width: 760px) 100vw, 54vw" preload={activeImage === 0} /> : <Image className="product-fallback-mascot" src={skin.mascot} alt="" fill sizes="(max-width: 760px) 100vw, 54vw" />}
            </div>
            <div className="product-thumbnails" aria-label="Product photos">
              {product.images.map((image, index) => <button key={image.url} type="button" onClick={() => setActiveImage(index)} aria-label={`Show product image ${index + 1}`} aria-pressed={activeImage === index}>
                <Image src={image.url} alt="" fill sizes="(max-width: 760px) 25vw, 12vw" />
              </button>)}
            </div>
          </div>
          <div className="product-information artifact-product-information">
            <span className="eyebrow">{product.productType}</span>
            <h1>{product.title}</h1>
            <div className="detail-price-row"><strong>{formatINR(price.amount)}</strong>{product.preview ? <span className="draft-label">Draft price</span> : <span className="detail-currency">{price.currencyCode}</span>}</div>
            <p className="product-lede">{product.description}</p>

            {product.variants.length > 1 ? <label className="variant-select">Choose your option<select value={variantId} onChange={(event) => {
              setVariantId(event.target.value);
              const selectedNumericId = event.target.value.split("/").at(-1);
              if (selectedNumericId && /^\d{1,20}$/.test(selectedNumericId)) {
                const url = new URL(window.location.href);
                url.searchParams.set("variant", selectedNumericId);
                window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
              }
              const selected = product.variants.find((item) => item.id === event.target.value);
              const selectedItem = selected && createCommerceItem({ variantId: selected.id, title: product.title, price: selected.price.amount, brand: "Project Beej", category: product.productType, variant: selected.title });
              if (selected && selectedItem) emitCommerceEvent({ name: "select_item", currency: selected.price.currencyCode, items: [selectedItem], item_list_name: "Product variant" });
            }}>{product.variants.map((item) => <option key={item.id} value={item.id} disabled={!item.availableForSale}>{item.title}{item.availableForSale ? "" : " · unavailable"}</option>)}</select></label> : null}
            {product.preview ? <div className="preview-inline">This is a design preview. Pack size, final price, tax, stock and product facts must be confirmed in Shopify before orders open.</div> : null}
            <p className="availability" aria-live="polite">{product.preview ? "Preview only · no purchase available" : available ? "Ready to add to your bag" : "Currently unavailable"}</p>
            <div className="purchase-row">
              <div className="quantity-stepper" aria-label="Choose quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10}>+</button></div>
              <button className="button button-dark" type="button" onClick={() => void addToBag(false)} disabled={!available}>Add to bag</button>
            </div>
            <button className="button button-outline buy-now" type="button" onClick={() => void addToBag(true)} disabled={!available || buyingNow}>{buyingNow ? "Opening checkout…" : "Buy now"}</button>
            <p className="shipping-copy">Secure checkout, shipping options and payment are handled by Shopify.</p>
            <p className="form-message" role="status">{cartSnapshot.message || message}</p>

            <section className="product-accordions" aria-label="Product information">
              <details open><summary>About this snack</summary><p>{product.description}</p></details>
              <details><summary>Ingredients &amp; nutrition</summary><p>Verified ingredient and nutrition details will be added from the final product label.</p></details>
              <details><summary>Storage &amp; allergen information</summary><p>Check the product pack for the final storage and allergen information.</p></details>
              <details><summary>Frequently asked questions</summary>
                {faqs.length ? <div className="faq-list">{faqs.map((faq, index) => <div className="faq-item" key={`${faq.question}-${index}`}><button type="button" aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}>{faq.question}<span aria-hidden="true">{openFaq === index ? "−" : "+"}</span></button>{openFaq === index ? <p>{faq.answer}</p> : null}</div>)}</div> : <p>Product questions will appear here once added in Shopify.</p>}
              </details>
            </section>
          </div>
        </div>

        <section className="mascot-feature" aria-label="Meet the Project Beej snack squad">
          <div className="mascot-feature-art" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
            <Image src={skin.mascot} alt="" width={220} height={220} />
          </div>
          <div className="mascot-feature-copy">
            <span className="eyebrow">{skin.player}</span>
            <h2>Meet your snack sidekick.</h2>
            <p>{skin.player} is here to bring a little more character to your snack break.</p>
          </div>
          <span className="mascot-feature-mark" aria-hidden="true">✳</span>
        </section>

        <section className="reviews-section">
          <div><span className="eyebrow">The snack squad</span><h2>Real notes from real snackers</h2></div>
          {reviews.length ? <div className="review-grid">{reviews.map((review, index) => <article className="review-card" key={`${review.author}-${index}`}><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>{review.title ? <h3>{review.title}</h3> : null}<p>{review.body}</p><span>By {review.author}</span></article>)}</div> : <p className="review-empty">No approved reviews yet. Reviews will appear here after they’re added in Shopify.</p>}
        </section>
      </div>
    </>
  );
}
