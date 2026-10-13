import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getStorefrontMode } from "@/lib/storefront";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getPublicSiteUrl();
  if (!base || process.env.CONTEXT !== "production" || getStorefrontMode() !== "live") return [];
  const staticRoutes = ["", "/shop", "/about", "/contact", "/collections/roasted-makhana", "/collections/ready-to-roast", "/policies/privacy", "/policies/refund", "/policies/terms"];
  const productRoutes = await getProducts(await requestBuyerIp()).catch(() => []);
  return [
    ...staticRoutes.map((route) => ({ url: `${base}${route}`, changeFrequency: route === "/shop" ? "daily" as const : "monthly" as const, priority: route === "" ? 1 : 0.7 })),
    ...productRoutes.filter((product) => !product.preview && /^[a-z0-9][a-z0-9-]*$/i.test(product.handle)).map((product) => ({ url: `${base}/products/${product.handle}`, ...(product.updatedAt && Number.isFinite(Date.parse(product.updatedAt)) ? { lastModified: new Date(product.updatedAt) } : {}), changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
