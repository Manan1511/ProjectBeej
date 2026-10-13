"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";
import type { BeejProduct } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";

const skins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

function ProductCard({ product, listName, index }: { product: BeejProduct; listName: string; index: number }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const skin = skins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: product.productType };
  const image = product.images[0];
  const firstAvailable = product.variants.find((variant) => variant.availableForSale);
  const ready = !product.preview && product.availableForSale && firstAvailable;

  async function addToBag() {
    if (!firstAvailable || !ready) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await serializeCartWrite(() => fetch("/api/cart/lines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ variantId: firstAvailable.id, quantity: 1, clientKey: getBrowserCartKey() }) }));
      const result = await response.json() as { error?: string; cartId?: string; acceptedQuantity?: number; warnings?: Array<{ message: string }> };
      if (!response.ok) throw new Error(result.error || "Could not add this snack.");
      const acceptedQuantity = result.acceptedQuantity || 0;
      const item = createCommerceItem({ variantId: firstAvailable.id, title: product.title, price: firstAvailable.price.amount, quantity: acceptedQuantity, brand: "Project Beej", category: product.productType, variant: firstAvailable.title, listName, index });
      const shopifyProduct = createShopifyAnalyticsProduct({
        productGid: product.id,
        variantGid: firstAvailable.id,
        name: product.title,
        variantName: firstAvailable.title,
        brand: "Project Beej",
        category: product.productType,
        price: firstAvailable.price.amount,
        quantity: acceptedQuantity,
      });
      if (acceptedQuantity > 0 && item) emitCommerceEvent({ name: "add_to_cart", currency: firstAvailable.price.currencyCode, value: Number(firstAvailable.price.amount) * acceptedQuantity, items: [item] }, { shopifyCartId: result.cartId, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) });
      setStatus(result.warnings?.[0]?.message || "Added to your bag.");
      router.refresh();
    } catch (error) {
      emitCommerceEvent({ name: "commerce_error", action: "add_to_cart" });
      setStatus(error instanceof Error ? error.message : "Could not add this snack.");
    }
    finally { setBusy(false); }
  }

  return (
    <article className="product-card" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
      <Link className="product-card-image" href={`/products/${product.handle}`} aria-label={`View ${product.title}`} onClick={() => {
        const item = createCommerceItem({ variantId: firstAvailable?.id || product.variants[0]?.id || "", title: product.title, price: product.price.amount, brand: "Project Beej", category: product.productType, listName, index });
        if (item) emitCommerceEvent({ name: "select_item", currency: product.price.currencyCode, items: [item], item_list_name: listName });
      }}>
        <Image className="product-mascot" src={skin.mascot} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" />
        {image ? <Image className="product-photo" src={image.url} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" /> : null}
        <span className="product-player">{skin.player}</span>
        {product.preview ? <span className="draft-price-flag">Preview</span> : null}
      </Link>
      <div className="product-card-copy">
        <span className="eyebrow">{product.productType}</span>
        <h3><Link href={`/products/${product.handle}`} onClick={() => {
          const item = createCommerceItem({ variantId: firstAvailable?.id || product.variants[0]?.id || "", title: product.title, price: product.price.amount, brand: "Project Beej", category: product.productType, listName, index });
          if (item) emitCommerceEvent({ name: "select_item", currency: product.price.currencyCode, items: [item], item_list_name: listName });
        }}>{product.title}</Link></h3>
        <p>{product.description}</p>
        <div className="product-card-bottom">
          <span className="product-price">{formatINR(product.price.amount)}{product.preview ? <small>draft</small> : null}</span>
          {ready ? <button className="card-add-button" type="button" onClick={addToBag} disabled={busy}>{busy ? "Adding…" : "Add to bag +"}</button> : <span className="unavailable-note">{product.preview ? "Setup preview" : "Coming soon"}</span>}
        </div>
        <p className="card-status" role="status">{status}</p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, filters = false, listName = "Product list" }: { products: BeejProduct[]; filters?: boolean; listName?: string }) {
  const [category, setCategory] = useState("All snacks");
  const [sort, setSort] = useState("featured");
  const shown = useMemo(() => {
    const filtered = category === "All snacks" ? products : products.filter((product) => product.productType === category);
    if (sort === "price-low") return [...filtered].sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
    if (sort === "price-high") return [...filtered].sort((a, b) => Number(b.price.amount) - Number(a.price.amount));
    return filtered;
  }, [category, products, sort]);
  const lastListView = useRef("");

  useEffect(() => {
    if (!shown.length) return;
    const listKey = `${listName}:${category}:${sort}:${shown.map((product) => product.id).join(",")}`;
    if (lastListView.current === listKey) return;
    lastListView.current = listKey;
    const items = shown.flatMap((product, index) => {
      const variant = product.variants.find((item) => item.availableForSale) || product.variants[0];
      const item = variant && createCommerceItem({ variantId: variant.id, title: product.title, price: variant.price.amount, brand: "Project Beej", category: product.productType, variant: variant.title, listName, index: index + 1 });
      return item ? [item] : [];
    });
    if (items.length) emitCommerceEvent({ name: "view_item_list", currency: shown[0]?.price.currencyCode, items, item_list_name: listName, item_list_id: listName.toLowerCase().replace(/[^a-z0-9]+/g, "_") });
  }, [category, listName, shown, sort]);

  return (
    <>
      {filters ? (
        <div className="catalog-controls">
          <div className="filter-pills" role="group" aria-label="Filter products by category">
            {["All snacks", "Roasted Makhana", "Ready to Roast"].map((item) => (
              <button className={category === item ? "filter-pill selected" : "filter-pill"} type="button" key={item} onClick={() => setCategory(item)} aria-pressed={category === item}>
                {item === "All snacks" ? item : item === "Roasted Makhana" ? "Roasted" : "Ready to roast"}
              </button>
            ))}
          </div>
          <label className="sort-control">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
          </select></label>
        </div>
      ) : null}
      {shown.length ? <div className="product-grid">{shown.map((product, index) => <ProductCard product={product} listName={listName} index={index + 1} key={product.id} />)}</div> : (
        <div className="empty-products"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>The pantry is sprouting</h2><p>Products will appear here when they’re published in Shopify.</p></div>
      )}
    </>
  );
}
