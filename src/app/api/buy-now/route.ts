import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeQuantity } from "@/lib/commerce";
import { requestBuyerIp } from "@/lib/request-ip";
import { createBuyNowCart, trustedCheckoutUrl } from "@/lib/cart-actions";
import { createShopifyCart, getStorefrontMode } from "@/lib/storefront";
import { getFreshShopifyCheckoutUrl } from "@/lib/storefront";
import { synchronizeCartTrackingAttributes } from "@/lib/checkout-context";
import { toPublicShopifyCart } from "@/lib/commerce";

export const dynamic = "force-dynamic";

const buyNowSchema = z.object({ variantId: z.string().min(1).max(200), quantity: z.unknown().optional() });

export async function POST(request: NextRequest) {
  if (getStorefrontMode() === "preview") return NextResponse.json({ error: "Purchases are disabled while the storefront is in preview mode." }, { status: 503 });
  try {
    const body = buyNowSchema.parse(await request.json());
    const quantity = normalizeQuantity(body.quantity ?? 1);
    // A new, independent Shopify cart keeps the shopper's existing bag untouched.
    const buyerIp = await requestBuyerIp();
    const result = await createBuyNowCart(async (lines) => (await createShopifyCart(lines, buyerIp)).cartCreate, { merchandiseId: body.variantId, quantity });
    const consent = await synchronizeCartTrackingAttributes(result.cart.id, buyerIp);
    const checkoutUrl = await getFreshShopifyCheckoutUrl(result.cart.id, consent, buyerIp);
    if (!checkoutUrl) return NextResponse.json({ error: "Shopify checkout could not be opened." }, { status: 502 });
    const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
    const acceptedQuantity = result.cart.lines.filter((line) => line.merchandise.id === body.variantId).reduce((sum, line) => sum + line.quantity, 0);
    return NextResponse.json({ checkoutUrl: trustedCheckoutUrl(checkoutUrl, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts), cartId: toPublicShopifyCart(result.cart).id, acceptedQuantity: Math.min(quantity, acceptedQuantity), warnings: result.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Buy Now is unavailable." }, { status: 502 });
  }
}
