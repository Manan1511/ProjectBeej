"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";
import { cartCountStore } from "@/components/cart-count";
import { canIncreaseProductCardQuantity, canQueueAnotherAdd, initialProductCardCartState, productCardCartReducer } from "@/components/product-card-cart-state";
import type { BeejProduct, ShopifyCart } from "@/lib/types";
import { formatINR } from "@/lib/commerce";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";

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

function ProductCard({ product, listName, index, shopPresentation = false }: { product: BeejProduct; listName: string; index: number; shopPresentation?: boolean }) {
  const [status, setStatus] = useState("");
  const [hoverImageRequested, setHoverImageRequested] = useState(false);
  const [cartState, dispatchCartState] = useReducer(productCardCartReducer, initialProductCardCartState);
  const addFlowActiveRef = useRef(false);
  const requestedAddQuantityRef = useRef(0);
  const queuedAddIdsRef = useRef<string[]>([]);
  const skin = skins[product.handle] || { tint: "#D6EBC8", mascot: "/assets/seed.png", player: product.productType };
  const image = product.images[0];
  const firstAvailable = product.variants.find((variant) => variant.availableForSale);
  const ready = !product.preview && product.availableForSale && firstAvailable;
  const isHomeFeatured = listName === "Home featured";
  const isEditorialCard = isHomeFeatured || shopPresentation;
  const homeBadge = isEditorialCard ? homeBadges[product.handle] : undefined;
  const hoverImage = shopPresentation
    ? product.images[1] || (shopHoverImageFallbacks[product.handle] ? { url: shopHoverImageFallbacks[product.handle], alt: "" } : undefined)
    : undefined;
  const cartLine = (cart: ShopifyCart | undefined) => cart?.lines.find((line) => line.merchandise.id === firstAvailable?.id) || null;

  function queueAnotherAdd() {
    if (!addFlowActiveRef.current || requestedAddQuantityRef.current >= 10 || !firstAvailable) return;
    requestedAddQuantityRef.current += 1;
    const requestId = crypto.randomUUID();
    queuedAddIdsRef.current.push(requestId);
    cartCountStore.beginAdd(requestId);
    dispatchCartState({ type: "add-queue" });
    setStatus("");
  }

  async function requestAdd(quantity: number) {
    if (!firstAvailable) throw new Error("Choose an available snack before adding it to your bag.");
    const response = await serializeCartWrite(() => fetch("/api/cart/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId: firstAvailable.id, quantity, clientKey: getBrowserCartKey() }),
    }));
    const result = await response.json() as { error?: string; cartId?: string; cart?: ShopifyCart; acceptedQuantity?: number; warnings?: Array<{ message: string }> };
    if (!response.ok) throw new Error(result.error || "Could not add this snack.");
    return result;
  }

  function emitAcceptedAdd(acceptedQuantity: number, cartId?: string) {
    if (!firstAvailable || acceptedQuantity <= 0) return;
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
    if (item) emitCommerceEvent({ name: "add_to_cart", currency: firstAvailable.price.currencyCode, value: Number(firstAvailable.price.amount) * acceptedQuantity, items: [item] }, { shopifyCartId: cartId, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) });
  }

  async function addToBag() {
    if (!firstAvailable || !ready) return;
    if (addFlowActiveRef.current) {
      queueAnotherAdd();
      return;
    }
    addFlowActiveRef.current = true;
    requestedAddQuantityRef.current = 1;
    const initialRequestId = crypto.randomUUID();
    let activeRequestIds = [initialRequestId];
    let latestCart: ShopifyCart | undefined;
    let latestCartId: string | undefined;
    let latestWarning: string | undefined;
    let acceptedQuantity = 0;
    dispatchCartState({ type: "add-start" });
    setStatus("");
    cartCountStore.beginAdd(initialRequestId);

    try {
      let result = await requestAdd(1);
      latestCart = result.cart;
      latestCartId = result.cartId;
      latestWarning = result.warnings?.[0]?.message;
      acceptedQuantity += result.acceptedQuantity || 0;
      cartCountStore.confirmAdds(activeRequestIds, result.cart?.totalQuantity ?? 0);
      activeRequestIds = [];

      while (queuedAddIdsRef.current.length > 0) {
        activeRequestIds = queuedAddIdsRef.current.splice(0);
        result = await requestAdd(activeRequestIds.length);
        latestCart = result.cart;
        latestCartId = result.cartId;
        latestWarning = result.warnings?.[0]?.message || latestWarning;
        acceptedQuantity += result.acceptedQuantity || 0;
        cartCountStore.confirmAdds(activeRequestIds, result.cart?.totalQuantity ?? 0);
        activeRequestIds = [];
      }

      dispatchCartState({ type: "add-success", line: cartLine(latestCart) });
      emitAcceptedAdd(acceptedQuantity, latestCartId);
      setStatus(latestWarning || "Added to your bag.");
    } catch (error) {
      const failedRequestIds = [...activeRequestIds, ...queuedAddIdsRef.current];
      queuedAddIdsRef.current = [];
      cartCountStore.failAdds(failedRequestIds);
      if (latestCart) {
        dispatchCartState({ type: "add-success", line: cartLine(latestCart) });
        emitAcceptedAdd(acceptedQuantity, latestCartId);
      } else {
        dispatchCartState({ type: "add-failure" });
      }
      emitCommerceEvent({ name: "commerce_error", action: "add_to_cart" });
      setStatus(error instanceof Error ? error.message : "Could not add this snack.");
    } finally {
      addFlowActiveRef.current = false;
      requestedAddQuantityRef.current = 0;
    }
  }

  async function changeCartQuantity(nextQuantity: number) {
    if (!cartState.lineId || cartState.busy || !firstAvailable) return;
    const previousQuantity = cartState.quantity;
    const requestId = cartState.lineId;
    const method = nextQuantity === 0 ? "DELETE" : "PATCH";
    const url = nextQuantity === 0
      ? `/api/cart/lines?lineId=${encodeURIComponent(requestId)}`
      : "/api/cart/lines";
    dispatchCartState({ type: "change-start", quantity: nextQuantity });
    cartCountStore.beginChange(requestId, nextQuantity - previousQuantity);
    setStatus("");

    try {
      const response = await serializeCartWrite(() => fetch(url, {
        method,
        ...(method === "PATCH" ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId: requestId, quantity: nextQuantity }),
        } : {}),
      }));
      const result = await response.json() as { error?: string; cart?: ShopifyCart; acceptedQuantity?: number; removedQuantity?: number; warnings?: Array<{ message: string }> };
      if (!response.ok) throw new Error(result.error || "Could not update your bag.");

      const updatedLine = cartLine(result.cart);
      dispatchCartState({ type: "change-success", line: updatedLine });
      cartCountStore.confirmChange(requestId, result.cart?.totalQuantity ?? 0);

      const updatedQuantity = updatedLine?.quantity || 0;
      const added = updatedQuantity > previousQuantity;
      const amount = added
        ? result.acceptedQuantity || updatedQuantity - previousQuantity
        : result.removedQuantity || previousQuantity - updatedQuantity;
      if (amount > 0) {
        const item = createCommerceItem({ variantId: firstAvailable.id, title: product.title, price: firstAvailable.price.amount, quantity: amount, brand: "Project Beej", category: product.productType, variant: firstAvailable.title });
        const shopifyProduct = createShopifyAnalyticsProduct({ productGid: product.id, variantGid: firstAvailable.id, name: product.title, variantName: firstAvailable.title, brand: "Project Beej", category: product.productType, price: firstAvailable.price.amount, quantity: amount });
        if (item) emitCommerceEvent({ name: added ? "add_to_cart" : "remove_from_cart", currency: firstAvailable.price.currencyCode, value: Number(firstAvailable.price.amount) * amount, items: [item] }, added ? { shopifyCartId: result.cart?.id, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) } : {});
      }
      setStatus(result.warnings?.[0]?.message || (updatedQuantity === 0 ? "Removed from your bag." : "Bag quantity updated."));
    } catch (error) {
      dispatchCartState({ type: "change-failure", quantity: previousQuantity });
      cartCountStore.failChange(requestId);
      emitCommerceEvent({ name: "commerce_error", action: "cart_update" });
      setStatus(error instanceof Error ? error.message : "Could not update your bag.");
    }
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
          {ready && cartState.quantity > 0 ? <div className="quantity-stepper product-card-quantity-stepper" aria-label={`Quantity for ${product.title}`}>
            <button type="button" onClick={() => changeCartQuantity(cartState.quantity - 1)} disabled={cartState.busy || !cartState.lineId} aria-label={`Decrease ${product.title} quantity`}>−</button>
            <span aria-live="polite">{cartState.quantity}</span>
            <button type="button" onClick={() => canQueueAnotherAdd(cartState) ? queueAnotherAdd() : changeCartQuantity(cartState.quantity + 1)} disabled={!canIncreaseProductCardQuantity(cartState)} aria-label={`Increase ${product.title} quantity`}>+</button>
          </div> : ready ? <button className="card-add-button" type="button" aria-label={`Add ${product.title} to bag`} onClick={addToBag} disabled={cartState.busy}>{isEditorialCard ? "ADD" : "Add to bag +"}</button> : isEditorialCard ? <button className="card-add-button" type="button" aria-label={`Add ${product.title} ${product.preview ? "once products are published" : "when available"}`} disabled>ADD</button> : <span className="unavailable-note">{product.preview ? "Setup preview" : "Coming soon"}</span>}
        </div>
        <p className="card-status" role="status">{status}</p>
      </div>
    </article>
  );
}

export function ProductGrid({ products, filters = false, listName = "Product list", presentation = "default", toolbar }: { products: BeejProduct[]; filters?: boolean; listName?: string; presentation?: "default" | "shop"; toolbar?: ReactNode }) {
  const [category, setCategory] = useState("All snacks");
  const [sort, setSort] = useState("featured");
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
      {shown.length ? <div className={presentation === "shop" ? "product-grid artifact-shop-grid" : "product-grid"}>{shown.map((product, index) => <ProductCard product={product} listName={listName} index={index + 1} shopPresentation={presentation === "shop"} key={product.id} />)}</div> : (
        <div className="empty-products"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>The pantry is sprouting</h2><p>Products will appear here when they’re published in Shopify.</p></div>
      )}
    </>
  );
}
