import { ProductGrid } from "@/components/ProductGrid";
import { getCardCollectionProducts } from "@/lib/storefront";

export function CollectionCatalogFallback() {
  return <section className="catalog-section shop-loading" aria-label="Loading collection products" aria-busy="true"><div className="shop-loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="shop-loading-card" key={index}><span className="shop-loading-image" /><span /><span /><span /></div>)}</div><span className="sr-only">Loading products from Shopify…</span></section>;
}

export async function CollectionCatalog({ handle, title }: { handle: string; title: string }) {
  const products = await getCardCollectionProducts(handle);
  if (!products.length) return <section className="catalog-section"><div className="empty-products"><h2>No snacks in this collection yet</h2></div></section>;
  return <section className="catalog-section"><ProductGrid products={products} filters listName={title} /></section>;
}
