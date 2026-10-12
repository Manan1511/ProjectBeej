"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserCartKey, serializeCartWrite } from "@/components/cart-request";
import type { BeejProduct } from "@/lib/types";
import { formatINR } from "@/lib/commerce";

const skins: Record<string, { tint: string; mascot: string; player: string }> = {
  "peri-peri": { tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", player: "The Lifter" },
  cheese: { tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", player: "The Skater" },
  "himalayan-salt-pepper": { tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", player: "The Striker" },
  pudina: { tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", player: "The Smasher" },
  "classic-makhana": { tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", player: "The Original" },
};

function ProductCard({ product }: { product: BeejProduct }) {
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
      const result = await response.json() as { error?: string; warnings?: Array<{ message: string }> };
      if (!response.ok) throw new Error(result.error || "Could not add this snack.");
      setStatus(result.warnings?.[0]?.message || "Added to your bag.");
      router.refresh();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not add this snack."); }
    finally { setBusy(false); }
  }

  return (
    <article className="product-card" style={{ "--product-tint": skin.tint } as React.CSSProperties}>
      <Link className="product-card-image" href={`/products/${product.handle}`} aria-label={`View ${product.title}`}>
        <Image className="product-mascot" src={skin.mascot} alt="" fill sizes="(max-width: 760px) 50vw, 25vw" />
        {image ? <Image className="product-photo" src={image.url} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" unoptimized /> : null}
        <span className="product-player">{skin.player}</span>
        {product.preview ? <span className="draft-price-flag">Preview</span> : null}
      </Link>
      <div className="product-card-copy">
        <span className="eyebrow">{product.productType}</span>
        <h3><Link href={`/products/${product.handle}`}>{product.title}</Link></h3>
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

export function ProductGrid({ products, filters = false }: { products: BeejProduct[]; filters?: boolean }) {
  const [category, setCategory] = useState("All snacks");
  const [sort, setSort] = useState("featured");
  const shown = useMemo(() => {
    const filtered = category === "All snacks" ? products : products.filter((product) => product.productType === category);
    if (sort === "price-low") return [...filtered].sort((a, b) => Number(a.price.amount) - Number(b.price.amount));
    if (sort === "price-high") return [...filtered].sort((a, b) => Number(b.price.amount) - Number(a.price.amount));
    return filtered;
  }, [category, products, sort]);

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
      {shown.length ? <div className="product-grid">{shown.map((product) => <ProductCard product={product} key={product.id} />)}</div> : (
        <div className="empty-products"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>The pantry is sprouting</h2><p>Products will appear here when they’re published in Shopify.</p></div>
      )}
    </>
  );
}
