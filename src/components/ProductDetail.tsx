"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { BeejProduct, ProductFaq, ProductReview } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { ProductGrid } from "@/components/ProductGrid";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";

const fallbackSkins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/cut-lifter.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/cut-skater.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/cut-runner.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/cut-pickleball.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

async function postAction(url: string, variantId: string, quantity: number) {
  const response = await serializeCartWrite(() => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId, quantity, clientKey: getBrowserCartKey() }) }));
  const data = await response.json() as { error?: string; checkoutUrl?: string; warnings?: Array<{ message: string }> };
  if (!response.ok) throw new Error(data.error || "That snack could not be added right now.");
  return data;
}

export function ProductDetail({ product, faqs, reviews, related }: { product: BeejProduct; faqs: ProductFaq[]; reviews: ProductReview[]; related: BeejProduct[] }) {
  const router = useRouter();
  const skin = fallbackSkins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: "A Beej original" };
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState(product.variants.find((variant) => variant.availableForSale)?.id || product.variants[0]?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const variant = useMemo(() => product.variants.find((item) => item.id === variantId) || product.variants[0], [product.variants, variantId]);
  const price = variant?.price || product.price;
  const available = !product.preview && Boolean(variant?.availableForSale);

  async function addToBag(buyNow: boolean) {
    if (!variant || !available) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await postAction(buyNow ? "/api/buy-now" : "/api/cart/lines", variant.id, quantity);
      if (buyNow && result.checkoutUrl) window.location.assign(result.checkoutUrl);
      else {
        setMessage(result.warnings?.map((warning) => warning.message).join(" ") || "Added to your bag.");
        router.refresh();
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "That snack could not be added right now."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="product-page">
        <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/shop">Shop</Link><span>/</span><Link href={product.productType === "Ready to Roast" ? "/collections/ready-to-roast" : "/collections/roasted-makhana"}>{product.productType}</Link><span>/</span><span aria-current="page">{product.title}</span></nav>
        <div className="product-detail-grid">
          <div className="product-gallery">
            <div className="product-main-image" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
              {product.images[activeImage] ? <Image src={product.images[activeImage].url} alt={product.images[activeImage].alt} fill sizes="(max-width: 760px) 100vw, 54vw" unoptimized /> : <Image src={skin.mascot} alt="" fill sizes="(max-width: 760px) 100vw, 54vw" />}
            </div>
            <div className="product-thumbnails" aria-label="Product photos">
              {product.images.map((image, index) => <button key={image.url} type="button" onClick={() => setActiveImage(index)} aria-label={`Show product image ${index + 1}`} aria-pressed={activeImage === index}>
                <Image src={image.url} alt="" fill sizes="(max-width: 760px) 25vw, 12vw" unoptimized />
              </button>)}
            </div>
          </div>
          <div className="product-information">
            <span className="eyebrow">{product.productType}</span>
            <h1>{product.title}</h1>
            <div className="detail-price-row"><strong>{formatINR(price.amount)}</strong>{product.preview ? <span className="draft-label">Draft price</span> : <span className="detail-currency">{price.currencyCode}</span>}</div>
            <p className="product-lede">{product.description}</p>

            {product.variants.length > 1 ? <label className="variant-select">Choose your option<select value={variantId} onChange={(event) => setVariantId(event.target.value)}>{product.variants.map((item) => <option key={item.id} value={item.id} disabled={!item.availableForSale}>{item.title}{item.availableForSale ? "" : " · unavailable"}</option>)}</select></label> : null}
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

        <section className="reviews-section">
          <div><span className="eyebrow">The snack squad</span><h2>Real notes from real snackers</h2></div>
          {reviews.length ? <div className="review-grid">{reviews.map((review, index) => <article className="review-card" key={`${review.author}-${index}`}><span className="review-stars" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>{review.title ? <h3>{review.title}</h3> : null}<p>{review.body}</p><span>— {review.author}</span></article>)}</div> : <p className="review-empty">No approved reviews yet. Reviews will appear here after they’re added in Shopify.</p>}
        </section>
      </div>
      {related.length ? <section className="related-section"><div className="section-heading"><div><span className="eyebrow">Another round?</span><h2>You might also like</h2></div><Link className="text-link" href="/shop">Shop all snacks ↗</Link></div><ProductGrid products={related} /></section> : null}
    </>
  );
}
