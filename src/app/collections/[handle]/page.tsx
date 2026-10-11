import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/ProductGrid";
import { getCollectionProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

const collections = {
  "roasted-makhana": { title: "Roasted makhana", eyebrow: "Big flavour, light crunch", description: "Meet the Beej roasted makhana squad: four flavours with plenty of personality." },
  "ready-to-roast": { title: "Ready to roast", eyebrow: "Your kitchen, your crunch", description: "Classic makhana, ready for you to roast and season your way at home." },
} as const;

type Handle = keyof typeof collections;
type Params = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const collection = collections[handle as Handle];
  return collection ? { title: collection.title, description: collection.description, ...(getPublicSiteUrl() ? { alternates: { canonical: `/collections/${handle}` } } : {}) } : { title: "Collection" };
}

export default async function CollectionPage({ params }: Params) {
  const { handle } = await params;
  if (!(handle in collections)) notFound();
  const collection = collections[handle as Handle];
  const products = await getCollectionProducts(handle, await requestBuyerIp()).catch(() => []);
  return <main id="main-content"><section className="collection-hero"><span className="eyebrow">{collection.eyebrow}</span><h1>{collection.title}<span>.</span></h1><p>{collection.description}</p></section><section className="catalog-section"><div className="breadcrumbs"><Link href="/shop">Shop all</Link><span>/</span><span>{collection.title}</span></div><ProductGrid products={products} filters /></section></main>;
}
