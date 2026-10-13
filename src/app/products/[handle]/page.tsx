import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/ProductDetail";
import { getProduct, getProducts, parseApprovedReviews, parseProductFaqs } from "@/lib/storefront";
import type { BeejProduct } from "@/lib/types";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { escapeJsonLd, isValidGtin, numericShopifyId } from "@/lib/product-feeds";

type Params = { params: Promise<{ handle: string }>; searchParams: Promise<{ variant?: string | string[] }> };

async function productFor(handle: string, buyerIp?: string): Promise<BeejProduct | null> {
  try { return await getProduct(handle, buyerIp); } catch { return null; }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const product = await productFor(handle, await requestBuyerIp());
  if (!product) return { title: "Snack" };
  const title = product.seo?.title?.trim() || product.title;
  const description = product.seo?.description?.trim() || product.description;
  return {
    title,
    description,
    robots: product.preview || process.env.CONTEXT !== "production" ? { index: false, follow: false } : undefined,
    ...(getPublicSiteUrl() ? { alternates: { canonical: `/products/${product.handle}` } } : {}),
    openGraph: { type: "website", title: `${title} | Project Beej`, description, ...(product.images[0]?.url.startsWith("https://") ? { images: [product.images[0].url] } : {}) },
  };
}

export async function generateStaticParams() {
  try { return (await getProducts()).map((product) => ({ handle: product.handle })); }
  catch { return []; }
}

export default async function ProductPage({ params, searchParams }: Params) {
  const [{ handle }, query] = await Promise.all([params, searchParams]);
  const buyerIp = await requestBuyerIp();
  const product = await productFor(handle, buyerIp);
  if (!product) notFound();
  const products = await getProducts(buyerIp).catch(() => []);
  const related = products.filter((item) => item.id !== product.id).slice(0, 4);
  const faqs = parseProductFaqs(product.metafields.faqs);
  const reviews = parseApprovedReviews(product.metafields.approvedReviews);
  const siteUrl = getPublicSiteUrl();
  const hasVerifiedReviews = reviews.length > 0;
  const offerFor = (variant: (typeof product.variants)[number]) => ({
    "@type": "Offer",
    url: `${siteUrl}/products/${product.handle}?variant=${numericShopifyId(variant.id)}`,
    priceCurrency: variant.price.currencyCode,
    price: variant.price.amount,
    availability: variant.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
  });
  const reviewSchema = hasVerifiedReviews ? {
    aggregateRating: { "@type": "AggregateRating", ratingValue: (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1), reviewCount: reviews.length },
    review: reviews.map((review) => ({ "@type": "Review", author: { "@type": "Person", name: review.author }, reviewBody: review.body, ...(review.title ? { name: review.title } : {}), reviewRating: { "@type": "Rating", ratingValue: review.rating, bestRating: 5, worstRating: 1 } })),
  } : {};
  const validVariants = product.variants.filter((variant) => numericShopifyId(variant.id));
  const schema = !product.preview && siteUrl ? {
    "@context": "https://schema.org",
    "@type": validVariants.length > 1 ? "ProductGroup" : "Product",
    name: product.title,
    description: product.description,
    image: product.images.map((image) => image.url).filter((url) => url.startsWith("https://")),
    brand: { "@type": "Brand", name: product.vendor || "Project Beej" },
    ...(validVariants.length > 1 ? { productGroupID: product.id, variesBy: product.variants[0]?.selectedOptions.map((option) => `https://schema.org/${option.name}`) || [], hasVariant: validVariants.map((variant) => ({ "@type": "Product", name: `${product.title}${variant.title === "Default Title" ? "" : ` ${variant.title}`}`, sku: variant.sku || undefined, ...(isValidGtin(variant.barcode) ? { gtin: variant.barcode } : {}), offers: offerFor(variant), ...reviewSchema })) } : { sku: validVariants[0]?.sku || undefined, ...(isValidGtin(validVariants[0]?.barcode) ? { gtin: validVariants[0]?.barcode } : {}), offers: validVariants[0] ? offerFor(validVariants[0]) : undefined, ...reviewSchema }),
  } : null;
  const breadcrumb = siteUrl ? { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
    { "@type": "ListItem", position: 2, name: "Shop", item: `${siteUrl}/shop` },
    { "@type": "ListItem", position: 3, name: product.productType, item: `${siteUrl}/collections/${product.productType === "Ready to Roast" ? "ready-to-roast" : "roasted-makhana"}` },
    { "@type": "ListItem", position: 4, name: product.title, item: `${siteUrl}/products/${product.handle}` },
  ] } : null;
  const rawVariant = Array.isArray(query.variant) ? query.variant[0] : query.variant;
  const selectedVariantId = rawVariant && /^\d{1,20}$/.test(rawVariant) ? product.variants.find((variant) => numericShopifyId(variant.id) === rawVariant)?.id : undefined;

  return <main id="main-content">{schema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(schema) }} /> : null}{breadcrumb ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(breadcrumb) }} /> : null}<ProductDetail product={product} faqs={faqs} reviews={reviews} related={related} initialVariantId={selectedVariantId} /></main>;
}
