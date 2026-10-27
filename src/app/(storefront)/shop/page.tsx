import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import { ShopEditorialSections } from "@/components/ShopEditorialSections";
import { ShopCatalog, ShopCatalogFallback } from "@/components/ShopCatalog";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getRequestCachedSiteSettings } from "@/lib/storefront";
import { contentFromSettings, resolveAdminSiteSettings } from "@/lib/admin-content";
import type { SiteSettings } from "@/lib/types";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  const hasSearch = Boolean(Array.isArray(q) ? q.some((term) => term.trim()) : q?.trim());
  return { title: "Shop all snacks", description: "Snacks made from nature's humblest ingredients. Free shipping on orders above ₹499.", ...(hasSearch ? { robots: { index: false, follow: true } } : {}), ...(getPublicSiteUrl() ? { alternates: { canonical: "/shop" } } : {}) };
}
export default async function ShopPage({ searchParams }: Props) {
  return ShopPageContent({ searchParams });
}

export async function ShopPageContent({ searchParams, settingsOverride, previewMode = false }: Props & { settingsOverride?: SiteSettings; previewMode?: boolean }) {
  const settings = resolveAdminSiteSettings(settingsOverride || await getRequestCachedSiteSettings());
  const content = contentFromSettings(settings);
  const copy = content.shopCopy;
  return <main id="main-content" className="artifact-shop">
    <section className="catalog-hero artifact-shop-hero" aria-labelledby="shop-title">
      <Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" />
      <div className="catalog-hero-shade" />
      <div className="catalog-hero-copy artifact-shop-copy">
        <div className="artifact-shop-heading"><span className="eyebrow">{copy.heroEyebrow}</span><h1 id="shop-title">{copy.heroTitle}</h1></div>
        <p>{copy.heroDescriptionLineOne}<br />{copy.heroDescriptionLineTwo}</p>
      </div>
    </section>
    <Suspense fallback={<ShopCatalogFallback />}><ShopCatalog searchParams={searchParams} previewMode={previewMode} /></Suspense>
    <ShopEditorialSections settings={settings} />
  </main>;
}
