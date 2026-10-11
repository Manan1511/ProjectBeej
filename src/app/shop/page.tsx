import type { Metadata } from "next";
import Image from "next/image";
import { ProductGrid } from "@/components/ProductGrid";
import { getProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Shop all snacks", description: "Meet the Project Beej snack squad: roasted makhana and ready-to-roast classics.", ...(getPublicSiteUrl() ? { alternates: { canonical: "/shop" } } : {}) };

export default async function ShopPage() {
  const products = await getProducts(await requestBuyerIp()).catch(() => []);
  return <main id="main-content">
    <section className="catalog-hero"><Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" /><div className="catalog-hero-shade" /><div><span className="eyebrow">The Beej pantry</span><h1>Shop all.</h1><p>Snacks made from nature’s humblest ingredients. Find your flavour and meet your player.</p></div></section>
    <section className="catalog-section"><div className="catalog-intro"><div><span className="eyebrow">Find your favourite</span><h2>The snack squad</h2></div><p>Four bold flavours, plus a classic makhana for your own kitchen adventures.</p></div><ProductGrid products={products} filters /></section>
  </main>;
}
