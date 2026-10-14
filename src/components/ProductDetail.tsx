"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BeejProduct, ProductFaq, ProductReview } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { ProductGrid } from "@/components/ProductGrid";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";

const fallbackSkins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

async function postAction(url: string, variantId: string, quantity: number) {
  const response = await serializeCartWrite(() => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity, clientKey: getBrowserCartKey() }) }));
  const data = await response.json() as { error?: string; checkoutUrl?: string; cartId?: string; acceptedQuantity?: number; warnings?: Array<{ message: string }> };
  if (!response.ok) throw Object.assign(new Error(data.error || "That snack could not be added right now."), { status: response.status });
  return data;
}

export function ProductDetail({ product, faqs, reviews, related, initialVariantId }: { product: BeejProduct; faqs: ProductFaq[]; reviews: ProductReview[]; related: BeejProduct[]; initialVariantId?: string }) {
  const router = useRouter();
  const skin = fallbackSkins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: "A Beej original" };
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState(initialVariantId || product.variants.find((variant) => variant.availableForSale)?.id || product.variants[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const viewedProduct = useRef("");
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) || product.variants[0], [product.variants, variantId]);
  const price = variant?.price || product.price;
  const available = !product.preview && Boolean(variant?.availableForSale);

  useEffect(() => {
    if (!variant || viewedProduct.current === product.id) return;
    viewedProduct.current = product.id;
    const item = createCommerceItem({ variantId: variant.id, title: product.title, price: variant.price.amount, brand: "Project Beej", category: product.productType, variant: variant.title });
    if (item) emitCommerceEvent({ name: "view_item", currency: variant.price.currencyCode, value: Number(variant.price.amount), items: [item] });
  }, [product, variant]);

  async function addToBag(buyNow: boolean) {
    if (!variant || !available) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await postAction(buyNow ? "/api/buy-now" : "/api/cart/lines", variant.id, quantity);
      const acceptedQuantity = result.acceptedQuantity || 0;
      const item = createCommerceItem({ variantId: variant.id, title: product.title, price: variant.price.amount, quantity: acceptedQuantity, brand: "Project Beej", category: product.productType, variant: variant.title });
      const shopifyProduct = createShopifyAnalyticsProduct({ productGid: product.id, variantGid: variant.id, name: product.title, variantName: variant.title, brand: "Project Beej", category: product.productType, price: variant.price.amount, quantity: acceptedQuantity });
      if (acceptedQuantity > 0 && item) emitCommerceEvent({ name: "add_to_cart", currency: variant.price.currencyCode, value: Number(variant.price.amount) * acceptedQuantity, items: [item] }, { shopifyCartId: result.cartId, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) });
      if (buyNow && result.checkoutUrl) {
        if (acceptedQuantity > 0 && item) emitCommerceEvent({ name: "begin_checkout", currency: variant.price.currencyCode, value: Number(variant.price.amount) * acceptedQuantity, items: [item] });
        window.location.assign(result.checkoutUrl);
      }
      else {
        setMessage(result.warnings?.map((warning) => warning.message).join(" ") || "Added to your bag.");
        router.refresh();
      }
    } catch (error) {
      emitCommerceEvent({ name: "commerce_error", action: buyNow ? "buy_now" : "add_to_cart", ...(typeof (error as { status?: unknown })?.status === "number" ? { status_code: (error as { status: number }).status } : {}) });
      setMessage(error instanceof Error ? error.message : "That snack could not be added right now.");
    }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="product-page artifact-product-shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span>/</span><Link href={product.productType === "Ready to Roast" ? "/collections/ready-to-roast" : "/collections/roasted-makhana"}>{product.productType}</Link><span>/</span><span aria-current="page">{product.title}</span></nav>
        <div className="product-detail-grid artifact-product-layout">
          <div className="product-gallery">
            <div className="product-main-image" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
              {product.images[activeImage] ? <Image src={product.images[activeImage].url} alt={product.images[activeImage].alt} fill sizes="(max-width: 760px) 100vw, 54vw" /> : <Image className="product-fallback-mascot" src={skin.mascot} alt="" fill sizes="(max-width: 760px) 100vw, 54vw" />}
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
              const selected = product.variants.find((item) => item.id === event.target.value);
              const selectedItem = selected && createCommerceItem({ variantId: selected.id, title: product.title, price: selected.price.amount, brand: "Project Beej", category: product.productType, variant: selected.title });
              if (selected && selectedItem) emitCommerceEvent({ name: "select_item", currency: selected.price.currencyCode, items: [selectedItem], item_list_name: "Product variant" });
            }}>{product.variants.map((item) => <option key={item.id} value={item.id} disabled={!item.availableForSale}>{item.title}{item.availableForSale ? "" : " · unavailable"}</option>)}</select></label> : null}
            {product.preview ? <div className="preview-inline">This is a design preview. Pack size, final price, tax, stock and product facts must be confirmed in Shopify before orders open.</div> : null}
            <p className="availability" aria-live="polite">{product.preview ? "Preview only · no purchase available" : available ? "Ready to add to your bag" : "Currently unavailable"}</p>
            <div className="purchase-row">
              <div className="quantity-stepper" aria-label="Choose quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>−</button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(Math.min(10, quantity + 1))} disabled={quantity >= 10}>+</button></div>
              <button className="button button-dark" type="button" onClick={() => addToBag(false)} disabled={!available || busy}>{busy ? "Adding…" : "Add to bag"}</button>
            </div>
            <button className="button button-outline buy-now" type="button" onClick={() => addToBag(true)} disabled={!available || busy}>{busy ? "Opening checkout…" : "Buy now"}</button>
            <p className="shipping-copy">Secure checkout, shipping options and payment are handled by Shopify.</p>
            <p className="form-message" role="status">{message}</p>

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
      {related.length ? <section className="related-section"><div className="section-heading"><div><span className="eyebrow">Another round?</span><h2>You might also like</h2></div><Link className="text-link" href="/shop">Shop all snacks ↗</Link></div><ProductGrid products={related} listName="Related products" /></section> : null}
    </>
  );
}
