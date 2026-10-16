import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { ShopEditorialSections } from "@/components/ShopEditorialSections";
import { getCardProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { searchProducts } from "@/lib/product-search";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const hasSearch = Boolean(Array.isArray(q) ? q.some((term) => term.trim()) : q?.trim());
  return { title: "Shop all snacks", description: "Snacks made from nature's humblest ingredients. Free shipping on orders above ₹499.", ...(hasSearch ? { robots: { index: false, follow: true } } : {}), ...(getPublicSiteUrl() ? { alternates: { canonical: "/shop" } } : {}) };
}

export default async function ShopPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] || "" : q || "").trim().slice(0, 80);
  const products = await getCardProducts(await requestBuyerIp()).catch(() => []);
  const results = searchProducts(products, query);
  return <main id="main-content" className="artifact-shop">
    <section className="catalog-hero artifact-shop-hero" aria-labelledby="shop-title">
      <Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" />
      <div className="catalog-hero-shade" />
      <div className="catalog-hero-copy artifact-shop-copy">
        <div className="artifact-shop-heading"><span className="eyebrow">The Beej pantry</span><h1 id="shop-title">Shop all</h1></div>
        <p>Snacks made from nature&apos;s humblest ingredients.<br />Free shipping on orders above ₹499.</p>
      </div>
    </section>
    <section className="catalog-section artifact-shop-catalog" aria-label="Shop snacks">
      {query && results.length === 0 ? <>
        <StoreSearchForm compact query={query} resultCount={results.length} />
        <div className="empty-products search-empty"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>No snacks found</h2><p>Try another flavour or snack type.</p><Link className="text-link" href="/shop#shop-search">Clear search ↗</Link></div>
      </> : <ProductGrid products={results} filters presentation="shop" toolbar={<StoreSearchForm compact query={query} resultCount={results.length} />} listName={query ? "Shop search results" : "Shop all"} />}
    </section>
    <ShopEditorialSections />
  </main>;
}
