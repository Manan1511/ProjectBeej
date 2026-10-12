import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { getProduct, getProducts, parseApprovedReviews, parseProductFaqs } from "@/lib/storefront";
import type { BeejProduct } from "@/lib/types";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

type Params = { params: Promise<{ handle: string }> };

async function productFor(handle: string, buyerIp?: string): Promise<BeejProduct | null> {
  try { return await getProduct(handle, buyerIp); } catch { return null; }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const product = await productFor(handle, await requestBuyerIp());
  if (!product) return { title: "Snack" };
  return {
    title: product.title,
    description: product.description,
    ...(getPublicSiteUrl() ? { alternates: { canonical: `/products/${product.handle}` } } : {}),
    openGraph: { title: `${product.title} | Project Beej`, description: product.description, ...(product.images[0]?.url.startsWith("https://") ? { images: [product.images[0].url] } : {}) },
  };
}

export async function generateStaticParams() {
  try { return (await getProducts()).map((product) => ({ handle: product.handle })); }
  catch { return []; }
}

export default async function ProductPage({ params }: Params) {
  const { handle } = await params;
  const buyerIp = await requestBuyerIp();
  const product = await productFor(handle, buyerIp);
  if (!product) notFound();
  const products = await getProducts(buyerIp).catch(() => []);
  const related = products.filter((item) => item.id !== product.id).slice(0, 4);
  const faqs = parseProductFaqs(product.metafields.faqs);
  const reviews = parseApprovedReviews(product.metafields.approvedReviews);
  const siteUrl = getPublicSiteUrl();
  const schema = !product.preview && siteUrl ? {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((image) => image.url).filter((url) => url.startsWith("https://")),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${product.handle}`,
      priceCurrency: product.price.currencyCode,
      price: product.price.amount,
      availability: product.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  } : null;

  return <main id="main-content">{schema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} /> : null}<ProductDetail product={product} faqs={faqs} reviews={reviews} related={related} /></main>;
}
