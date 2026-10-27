import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeQuantity } from "@/lib/commerce";
import { requestBuyerIp } from "@/lib/request-ip";
import { createBuyNowCart, trustedCheckoutUrl } from "@/lib/cart-actions";
import { createShopifyCart, getStorefrontMode } from "@/lib/storefront";
import { getFreshShopifyCheckoutUrl } from "@/lib/storefront";
import { synchronizeCartTrackingAttributes } from "@/lib/checkout-context";
import { toPublicShopifyCart } from "@/lib/commerce";
import { cashfreeCheckoutConfigured } from "@/lib/cashfree-core";
import { storeBuyNowCartId } from "@/lib/cart-cookie";

export const dynamic = "force-dynamic";

const buyNowSchema = z.object({ variantId: z.string().min(1).max(200), quantity: z.unknown().optional() });

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  if (getStorefrontMode() === "preview") return privateJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  try {
    const body = buyNowSchema.parse(await request.json());
    const quantity = normalizeQuantity(body.quantity ?? 1);
    // A new, independent Shopify cart keeps the shopper's existing bag untouched.
    const buyerIp = await requestBuyerIp();
    const result = await createBuyNowCart(async (lines) => (await createShopifyCart(lines, buyerIp)).cartCreate, { merchandiseId: body.variantId, quantity });
    const cashfreeCheckout = cashfreeCheckoutConfigured();
    if (cashfreeCheckout) await storeBuyNowCartId(result.cart.id);
    let checkoutUrl: string | null = null;
    if (!cashfreeCheckout) {
      const consent = await synchronizeCartTrackingAttributes(result.cart.id, buyerIp);
      checkoutUrl = await getFreshShopifyCheckoutUrl(result.cart.id, consent, buyerIp);
    }
    if (!cashfreeCheckout && !checkoutUrl) return privateJson({ error: "Shopify checkout could not be opened." }, 502);
    const customHosts = (process.env.SHOPIFY_CHECKOUT_HOSTS || "").split(",").filter(Boolean);
    const acceptedQuantity = result.cart.lines.filter((line) => line.merchandise.id === body.variantId).reduce((sum, line) => sum + line.quantity, 0);
    return privateJson({
      ...(cashfreeCheckout ? { checkoutPath: "/checkout?source=buy-now" } : { checkoutUrl: trustedCheckoutUrl(checkoutUrl!, process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com", customHosts) }),
      cartId: toPublicShopifyCart(result.cart).id,
      acceptedQuantity: Math.min(quantity, acceptedQuantity),
      warnings: result.warnings,
    });
  } catch (error) {
    return privateJson({ error: error instanceof Error ? error.message : "Buy Now is unavailable." }, 502);
  }
}
