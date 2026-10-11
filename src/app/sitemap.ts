import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteUrl();
  if (!base) return [];
  const staticRoutes = ["", "/shop", "/about", "/contact", "/search", "/collections/roasted-makhana", "/collections/ready-to-roast", "/policies/privacy", "/policies/refund", "/policies/terms"];
  const productRoutes = await getProducts(await requestBuyerIp()).catch(() => []);
  return [
    ...staticRoutes.map((route) => ({ url: `${base}${route}`, lastModified: new Date(), changeFrequency: route === "/shop" ? "daily" as const : "monthly" as const, priority: route === "" ? 1 : 0.7 })),
    ...productRoutes.map((product) => ({ url: `${base}/products/${product.handle}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
