import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { ShopEditorialSections } from "@/components/ShopEditorialSections";
import { ShopCatalog, ShopCatalogFallback } from "@/components/ShopCatalog";
import { getPublicSiteUrl } from "@/lib/site-url";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const hasSearch = Boolean(Array.isArray(q) ? q.some((term) => term.trim()) : q?.trim());
  return { title: "Shop all snacks", description: "Snacks made from nature's humblest ingredients. Free shipping on orders above ₹499.", ...(hasSearch ? { robots: { index: false, follow: true } } : {}), ...(getPublicSiteUrl() ? { alternates: { canonical: "/shop" } } : {}) };
}
export default function ShopPage({ searchParams }: Props) {
  return <main id="main-content" className="artifact-shop">
    <section className="catalog-hero artifact-shop-hero" aria-labelledby="shop-title">
      <Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" />
      <div className="catalog-hero-shade" />
      <div className="catalog-hero-copy artifact-shop-copy">
        <div className="artifact-shop-heading"><span className="eyebrow">The Beej pantry</span><h1 id="shop-title">Shop all</h1></div>
        <p>Snacks made from nature&apos;s humblest ingredients.<br />Free shipping on orders above ₹499.</p>
      </div>
    </section>
    <Suspense fallback={<ShopCatalogFallback />}><ShopCatalog searchParams={searchParams} /></Suspense>
    <ShopEditorialSections />
  </main>;
}
