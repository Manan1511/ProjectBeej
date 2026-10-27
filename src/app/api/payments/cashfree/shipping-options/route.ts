import { NextRequest, NextResponse } from "next/server";
import { readStoredBuyNowCartId, readStoredCartId } from "@/lib/cart-cookie";
import { cashfreeCheckoutConfigured } from "@/lib/cashfree-core";
import { cashfreeShippingOptionsSchema, checkoutPublicError, checkoutRequestIsSameOrigin, readBoundedCheckoutJson } from "@/lib/cashfree-checkout-handler";
import { getShopifyCart, getShopifyDeliveryOptions, selectShopifyDeliveryOptions, type ShopifyCheckoutAddress } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: NextRequest) {
  if (!checkoutRequestIsSameOrigin(request)) return json({ error: "Invalid checkout origin." }, 403);
  if (!cashfreeCheckoutConfigured()) return json({ error: "Cashfree sandbox checkout is not configured." }, 503);
  try {
    const body = await readBoundedCheckoutJson(request);
    if (!body.ok) return json({ error: body.status === 413 ? "Checkout details are too large." : "Enter valid checkout details." }, body.status);
    const parsed = cashfreeShippingOptionsSchema.safeParse(body.value);
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Check your delivery details." }, 400);
    const { source, buyer, address, deliverySelections } = parsed.data;
    const cartId = source === "buy-now" ? await readStoredBuyNowCartId() : await readStoredCartId();
    if (!cartId) return json({ error: "Your bag is empty. Add your snacks again to continue." }, 409);

    const buyerIp = await requestBuyerIp();
    const shopifyAddress: ShopifyCheckoutAddress = {
      ...address,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      phone: `+91${buyer.phone}`,
      countryCode: "IN",
    };
    const cart = await getShopifyCart(cartId, buyerIp);
    if (!cart || cart.totalQuantity < 1) return json({ error: "Your bag expired. Add your snacks again to continue." }, 410);

    const available = await getShopifyDeliveryOptions(cartId, shopifyAddress, buyerIp);
    const quote = deliverySelections
      ? await selectShopifyDeliveryOptions(cartId, deliverySelections, buyerIp)
      : available;
    return json({
      groups: available.groups,
      ...(deliverySelections ? {
        subtotal: quote.subtotal,
        total: quote.total,
        totalQuantity: quote.totalQuantity,
      } : { subtotal: available.subtotal, totalQuantity: available.totalQuantity }),
    });
  } catch (error) {
    const result = checkoutPublicError(error);
    return json({ error: result.message }, result.status);
  }
}
