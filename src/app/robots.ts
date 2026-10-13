import type { MetadataRoute } from "next";
import { getPublicSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getPublicSiteUrl();
  if (process.env.CONTEXT !== "production" || process.env.SHOPIFY_MODE === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/api/"] }, ...(base ? { sitemap: `${base}/sitemap.xml` } : {}) };
}
