import { NextRequest, NextResponse } from "next/server";
import { cashfreeCheckoutConfigured } from "@/lib/cashfree-core";
import { finalizeCashfreePayment } from "@/lib/cashfree-finalization";
import { readStoredCashfreeCheckoutSession, clearCashfreeCheckoutSession } from "@/lib/cashfree-session";
import { clearBuyNowCartId, clearStoredCartId, readStoredBuyNowCartId, readStoredCartId } from "@/lib/cart-cookie";
import { getShopifyCart } from "@/lib/storefront";
import { readCashfreeDraftQuote } from "@/lib/cashfree-shopify";
import { requestBuyerIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function GET(request: NextRequest) {
  if (!cashfreeCheckoutConfigured()) return json({ error: "Cashfree checkout is not configured." }, 503);
  const orderId = request.nextUrl.searchParams.get("order_id") || "";
  const session = await readStoredCashfreeCheckoutSession();
  if (!session || session.orderId !== orderId) return json({ error: "This payment session has expired. Return to your bag and check its status." }, 401);

  try {
    const result = await finalizeCashfreePayment(orderId);
    if (result.status === "paid") {
      if (session.source === "buy-now") {
        if (await readStoredBuyNowCartId() === session.cartId) await clearBuyNowCartId();
      } else if (await readStoredCartId() === session.cartId) {
        const buyerIp = await requestBuyerIp();
        const [cart, draft] = await Promise.all([
          getShopifyCart(session.cartId, buyerIp),
          readCashfreeDraftQuote(session.draftOrderId),
        ]);
        if (cart && draft) {
          const current = new Map<string, number>();
          for (const line of cart.lines) current.set(line.merchandise.id, (current.get(line.merchandise.id) || 0) + line.quantity);
          const purchased = new Map<string, number>();
          for (const line of draft.lineItems) if (line.variantId) purchased.set(line.variantId, (purchased.get(line.variantId) || 0) + line.quantity);
          const unchanged = current.size === purchased.size && [...purchased].every(([id, quantity]) => current.get(id) === quantity);
          if (unchanged) await clearStoredCartId();
        }
      }
      await clearCashfreeCheckoutSession();
    }
    return json(result);
  } catch {
    return json({ status: "processing", message: "Payment status is being checked with Cashfree and Shopify." }, 200);
  }
}
