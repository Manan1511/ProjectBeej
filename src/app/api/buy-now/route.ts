import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeQuantity } from "@/lib/commerce";
import { requestBuyerIp } from "@/lib/request-ip";
import { createBuyNowCart, trustedCheckoutUrl } from "@/lib/cart-actions";
import { createShopifyCart } from "@/lib/storefront";

export const dynamic = "force-dynamic";

const buyNowSchema = z.object({ variantId: z.string().min(1).max(200), quantity: z.unknown().optional() });

export async function POST(request: NextRequest) {
  try {
    const body = buyNowSchema.parse(await request.json());
    const quantity = normalizeQuantity(body.quantity ?? 1);
    // A new, independent Shopify cart keeps the shopper's existing bag untouched.
    const buyerIp = await requestBuyerIp();
    const result = await createBuyNowCart(async (lines) => (await createShopifyCart(lines, buyerIp)).cartCreate, { merchandiseId: body.variantId, quantity });
    const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
    return NextResponse.json({ checkoutUrl: trustedCheckoutUrl(result.cart.checkoutUrl, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts), warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Buy Now is unavailable." }, { status: 502 });
  }
}
