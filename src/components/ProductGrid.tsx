"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cartCoordinator, describeProductVariant, useCartSnapshot } from "@/components/cart-coordinator";
import type { CartCoordinatorSnapshot } from "@/components/cart-coordinator";
import type { BeejProduct } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { createCommerceItem, emitCommerceEvent } from "@/lib/tracking-client";

const skins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

const homeBadges: Record<string, string> = {
  "peri-peri": "Bestseller",
  cheese: "Bestseller",
  pudina: "New",
};

const shopHoverImageFallbacks: Record<string, string> = {
  "peri-peri": "/assets/peri-flatlay.jpg",
  cheese: "/assets/cheese-table.jpg",
  "himalayan-salt-pepper": "/assets/himalayan-hand.jpg",
  pudina: "/assets/pudina-pop.jpg",
  "classic-makhana": "/assets/makhana-lotus.jpg",
};

function ProductCard({ product, listName, index, cartSnapshot, shopPresentation = false }: { product: BeejProduct; listName: string; index: number; cartSnapshot: CartCoordinatorSnapshot; shopPresentation?: boolean }) {
  const [status, setStatus] = useState("");
  const [hoverImageRequested, setHoverImageRequested] = useState(false);
  const skin = skins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: product.productType };
  const image = product.images[0];
  const firstAvailable = product.variants.find((variant) => variant.availableForSale);
  const ready = !product.preview && product.availableForSale && firstAvailable;
  const quantity = cartSnapshot.cart?.lines.find((line) => line.merchandise.id === firstAvailable?.id)?.quantity || 0;
  const totalQuantity = cartSnapshot.cart?.totalQuantity || 0;
  const isHomeFeatured = listName === "Home featured";
  const isEditorialCard = isHomeFeatured || shopPresentation;
  const homeBadge = isEditorialCard ? homeBadges[product.handle] : undefined;
  const hoverImage = shopPresentation
    ? product.images[1] || (shopHoverImageFallbacks[product.handle] ? { url: shopHoverImageFallbacks[product.handle], alt: "" } : undefined)
    : undefined;
  function changeCartQuantity(delta: number) {
    if (!firstAvailable || !ready) return;
    const changed = cartCoordinator.adjustQuantity(firstAvailable.id, delta, describeProductVariant(product, firstAvailable));
    if (changed) setStatus(delta > 0 && quantity === 0 ? "Added to your bag." : "Bag quantity updated.");
  }

  return (
    <article className={isHomeFeatured ? "product-card home-product-card" : shopPresentation ? "product-card shop-product-card" : "product-card"} style={{ "--product-tint": skin.tint } as React.CSSProperties}>
      <Link className="product-card-image" href={`/products/${product.handle}`} aria-label={`View ${product.title}`} data-hover-image-src={hoverImage?.url} onPointerEnter={() => setHoverImageRequested(true)} onFocus={() => setHoverImageRequested(true)} onClick={() => {
        const item = createCommerceItem({ variantId: firstAvailable?.id || product.variants[0]?.id || "", title: product.title, price: product.price.amount, brand: "Project Beej", category: product.productType, listName, index });
        if (item) emitCommerceEvent({ name: "select_item", currency: product.price.currencyCode, items: [item], item_list_name: listName });
      }}>
        {!isEditorialCard && !hoverImage ? <Image className="product-mascot" src={skin.mascot} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" /> : null}
        {image ? <Image className="product-photo" src={image.url} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" /> : null}
        {hoverImage && hoverImageRequested ? <Image className="product-hover-photo" src={hoverImage.url} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" /> : null}
        {!isEditorialCard ? <span className="product-player">{skin.player}</span> : null}
        {homeBadge ? <span className="home-product-badge">{homeBadge}</span> : null}
        {product.preview && !isEditorialCard ? <span className="draft-price-flag">Preview</span> : null}
      </Link>
      <div className="product-card-copy">
        <span className="eyebrow">{product.productType}</span>
        <h3><Link href={`/products/${product.handle}`} onClick={() => {
          const item = createCommerceItem({ variantId: firstAvailable?.id || product.variants[0]?.id || "", title: product.title, price: product.price.amount, brand: "Project Beej", category: product.productType, listName, index });
          if (item) emitCommerceEvent({ name: "select_item", currency: product.price.currencyCode, items: [item], item_list_name: listName });
        }}>{product.title}</Link></h3>
        {isEditorialCard ? null : <p>{product.description}</p>}
        <div className="product-card-bottom">
          <div className="home-product-cost">
            <span className="product-price">{formatINR(product.price.amount)}{product.preview && !isEditorialCard ? <small>draft</small> : null}</span>
            {isEditorialCard ? <span className="product-unit">Jar</span> : null}
          </div>
          {ready && quantity > 0 ? <div className="quantity-stepper product-card-quantity-stepper" aria-label={`Quantity for ${product.title}`}>
            <button type="button" onClick={() => changeCartQuantity(-1)} aria-label={`Decrease ${product.title} quantity`}>−</button>
            <span aria-live="polite">{quantity}</span>
            <button type="button" onClick={() => changeCartQuantity(1)} disabled={quantity >= 10 || totalQuantity >= 10} aria-label={`Increase ${product.title} quantity`}>+</button>
          </div> : ready ? <button className="card-add-button" type="button" aria-label={`Add ${product.title} to bag`} onClick={() => changeCartQuantity(1)}>{isEditorialCard ? "ADD" : "Add to bag +"}</button> : isEditorialCard ? <button className="card-add-button" type="button" aria-label={`Add ${product.title} ${product.preview ? "once products are published" : "when available"}`} disabled>ADD</button> : <span className="unavailable-note">{product.preview ? "Setup preview" : "Coming soon"}</span>}
        </div>
        <p className="card-status" role="status">{status}</p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, filters = false, listName = "Product list", presentation = "default", toolbar }: { products: BeejProduct[]; filters?: boolean; listName?: string; presentation?: "default" | "shop"; toolbar?: ReactNode }) {
  const [category, setCategory] = useState("All snacks");
  const [sort, setSort] = useState("featured");
  const cartSnapshot = useCartSnapshot();
  const shown = useMemo(() => {
    const filtered = category === "All snacks" ? products : products.filter((product) => product.productType === category);
    if (sort === "price-low") return [...filtered].sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
    if (sort === "price-high") return [...filtered].sort((a, b) => Number(b.price.amount) - Number(a.price.amount));
    return filtered;
  }, [category, products, sort]);
  const filterOptions = presentation === "shop" ? [
    { value: "All snacks", label: `All ${products.length}` },
    { value: "Roasted Makhana", label: `Roasted Makhana ${products.filter((product) => product.productType === "Roasted Makhana").length}` },
    { value: "Ready to Roast", label: `Ready to Roast ${products.filter((product) => product.productType === "Ready to Roast").length}` },
  ] : [
    { value: "All snacks", label: "All snacks" },
    { value: "Roasted Makhana", label: "Roasted" },
    { value: "Ready to Roast", label: "Ready to roast" },
  ];
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
        <div className={presentation === "shop" ? "catalog-controls artifact-shop-controls" : "catalog-controls"}>
          <div className="filter-pills" role="group" aria-label="Filter products by category">
            {filterOptions.map(({ value, label }) => (
              <button className={category === value ? "filter-pill selected" : "filter-pill"} type="button" key={value} onClick={() => setCategory(value)} aria-pressed={category === value}>
                {label}
              </button>
            ))}
          </div>
          {toolbar ? <div className="catalog-controls-trailing">
            <div className="catalog-controls-search">{toolbar}</div>
            <label className="sort-control">Sort <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
            </select></label>
          </div> : <label className="sort-control">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
          </select></label>}
        </div>
      ) : null}
      {cartSnapshot.message ? <p className="product-grid-status form-message" role="status">{cartSnapshot.message}</p> : null}
      {shown.length ? <div className={presentation === "shop" ? "product-grid artifact-shop-grid" : "product-grid"}>{shown.map((product, index) => <ProductCard product={product} listName={listName} index={index + 1} cartSnapshot={cartSnapshot} shopPresentation={presentation === "shop"} key={product.id} />)}</div> : (
        <div className="empty-products"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>The pantry is sprouting</h2><p>Products will appear here when they’re published in Shopify.</p></div>
      )}
    </>
  );
}
