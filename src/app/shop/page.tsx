import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/ProductGrid";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { getProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { searchProducts } from "@/lib/product-search";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const hasSearch = Boolean(Array.isArray(q) ? q.some((term) => term.trim()) : q?.trim());
  return { title: "Shop all snacks", description: "Meet the Project Beej snack squad: roasted makhana and ready-to-roast classics.", ...(hasSearch ? { robots: { index: false, follow: true } } : {}), ...(getPublicSiteUrl() ? { alternates: { canonical: "/shop" } } : {}) };
}

export default async function ShopPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (Array.isArray(q) ? q[0] || "" : q || "").trim().slice(0, 80);
  const products = await getProducts(await requestBuyerIp()).catch(() => []);
  const results = searchProducts(products, query);
  return <main id="main-content">
    <section className="catalog-hero"><Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" /><div className="catalog-hero-shade" /><div><span className="eyebrow">The Beej pantry</span><h1>Shop all.</h1><p>Snacks made from nature’s humblest ingredients. Find your flavour and meet your player.</p></div></section>
    <section className="catalog-section"><div className="catalog-intro"><div><span className="eyebrow">Find your favourite</span><h2>The snack squad</h2></div><p>Four bold flavours, plus a classic makhana for your own kitchen adventures.</p></div><StoreSearchForm query={query} resultCount={results.length} />{query && results.length === 0 ? <div className="empty-products search-empty"><Image src="/assets/seed.png" alt="" width={54} height={54} /><h2>No snacks found</h2><p>Try another flavour or snack type.</p><Link className="text-link" href="/shop#shop-search">Clear search ↗</Link></div> : <ProductGrid products={results} filters={!query} listName={query ? "Shop search results" : "Shop all"} />}</section>
  </main>;
}
