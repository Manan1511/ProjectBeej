import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { getCardProducts } from "@/lib/storefront";
import { searchProducts } from "@/lib/product-search";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export function ShopCatalogFallback() {
  return <section className="catalog-section artifact-shop-catalog shop-loading" aria-label="Loading snacks" aria-busy="true">
    <div className="shop-loading-toolbar"><span /><span /><span /></div>
    <div className="shop-loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="shop-loading-card" key={index}><span className="shop-loading-image" /><span /><span /><span /></div>)}</div>
    <span className="sr-only">Loading products from Shopify…</span>
  </section>;
}

export async function ShopCatalog({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] || "" : q || "").trim().slice(0, 80);
  const products = await getCardProducts();
  const results = searchProducts(products, query);
  if (!query && results.length === 0) {
    return <section className="catalog-section artifact-shop-catalog" aria-label="Shop snacks"><div className="empty-products"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>No snacks are available right now</h2><p>Please check back soon.</p></div></section>;
  }
  return <section className="catalog-section artifact-shop-catalog" aria-label="Shop snacks">
    {query && results.length === 0 ? <>
      <StoreSearchForm key={query} compact query={query} resultCount={results.length} />
      <div className="empty-products search-empty"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>No snacks found</h2><p>Try another flavour or snack type.</p><Link className="text-link" href="/shop#shop-search">Clear search ↗</Link></div>
    </> : <ProductGrid products={results} filters presentation="shop" toolbar={<StoreSearchForm key={query} compact query={query} resultCount={results.length} />} listName={query ? "Shop search results" : "Shop all"} />}
  </section>;
}
