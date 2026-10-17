import { NextResponse } from "next/server";
import { clearStoredCartId, readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { getShopifyCart } from "@/lib/storefront";
import { toPublicShopifyCart } from "@/lib/commerce";
import { withKeyedLock } from "@/lib/lock";

export const dynamic = "force-dynamic";

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET() {
  try {
    const cartId = await readStoredCartId();
    if (!cartId) return privateJson({ cart: null, expired: false });

    return await withKeyedLock(`cart:${cartId}`, async () => {
      const cart = await getShopifyCart(cartId, await requestBuyerIp());
      if (!cart || cart.totalQuantity < 1) {
        await clearStoredCartId();
        return privateJson({ cart: null, expired: Boolean(cartId) });
      }
      return privateJson({ cart: toPublicShopifyCart(cart), expired: false });
    });
  } catch {
    return privateJson({ error: "Your bag could not be loaded. Try again." }, 502);
  }
}
