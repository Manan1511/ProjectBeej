import { NextResponse } from "next/server";
import { getProducts, getStorefrontMode } from "@/lib/storefront";
import { getPublicSiteUrl } from "@/lib/site-url";
import { buildGoogleMerchantFeed } from "@/lib/product-feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  if (process.env.CONTEXT !== "production" || getStorefrontMode() !== "live" || !siteUrl) {
    return new NextResponse("Feed unavailable.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const products = await getProducts();
    const feed = buildGoogleMerchantFeed(products, siteUrl);
    return new NextResponse(feed, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Product feed temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
