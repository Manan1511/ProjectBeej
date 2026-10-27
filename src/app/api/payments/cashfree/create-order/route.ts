import { createHmac, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readStoredBuyNowCartId, readStoredCartId } from "@/lib/cart-cookie";
import { CashfreeError, cashfreeAmountMatches, cashfreeCheckoutConfigured, createCashfreeOrderId, getCashfreeConfig, type CashfreeOrder } from "@/lib/cashfree-core";
import { createCashfreeOrder, getCashfreeOrder } from "@/lib/cashfree";
import { cashfreeCreateOrderSchema, checkoutPublicError, checkoutRequestIsSameOrigin, readBoundedCheckoutJson } from "@/lib/cashfree-checkout-handler";
import { cashfreeDraftMatchesCheckout, createCashfreeDraftQuote, deleteCashfreeDraftQuote, readCashfreeDraftQuote, ShopifyCashfreeError } from "@/lib/cashfree-shopify";
import { storeCashfreeCheckoutSession } from "@/lib/cashfree-session";
import { requestBuyerIp } from "@/lib/request-ip";
import { getShopifyCart, getShopifyDeliveryOptions, selectShopifyDeliveryOptions, type ShopifyCheckoutAddress } from "@/lib/storefront";
import { withKeyedLock } from "@/lib/lock";
import { consumeDurableRateLimit } from "@/lib/tracking-store";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function appOrigin(request: Request): string {
  if (process.env.NODE_ENV === "production" && process.env.SITE_URL) {
    try {
      const url = new URL(process.env.SITE_URL);
      if (url.protocol === "https:") return url.origin;
    } catch { /* Use the validated request origin below. */ }
  }
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  if (!checkoutRequestIsSameOrigin(request)) return json({ error: "Invalid checkout origin." }, 403);
  if (!cashfreeCheckoutConfigured()) return json({ error: "Cashfree sandbox checkout is not configured." }, 503);
  try {
    const body = await readBoundedCheckoutJson(request);
    if (!body.ok) return json({ error: body.status === 413 ? "Checkout details are too large." : "Enter valid checkout details." }, body.status);
    const parsed = cashfreeCreateOrderSchema.safeParse(body.value);
    if (!parsed.success) return json({ error: parsed.error.issues[0]?.message || "Check your delivery details." }, 400);
    const { source, buyer, address, deliverySelections, attemptId } = parsed.data;
    const cartId = source === "buy-now" ? await readStoredBuyNowCartId() : await readStoredCartId();
    if (!cartId) return json({ error: "Your bag is empty. Add your snacks again to continue." }, 409);
    const buyerIp = await requestBuyerIp();
    const limiterSecret = getCashfreeConfig()?.sessionSecret;
    if (!limiterSecret) return json({ error: "Cashfree sandbox checkout is not configured." }, 503);
    const limiterSubject = buyerIp && /^[0-9a-fA-F:.]{2,64}$/.test(buyerIp) ? buyerIp.toLowerCase() : cartId;
    const limiterKey = createHmac("sha256", limiterSecret).update(`cashfree-create-order:${limiterSubject}`).digest("hex");
    try {
      if (!await consumeDurableRateLimit(limiterKey)) return json({ error: "Too many payment attempts. Wait a minute, then try again." }, 429);
    } catch {
      return json({ error: "Payment checkout is temporarily unavailable. Try again shortly." }, 503);
    }

    return await withKeyedLock(`cart:${cartId}`, async () => {
      const shopifyAddress: ShopifyCheckoutAddress = {
        ...address,
        firstName: buyer.firstName,
        lastName: buyer.lastName,
        phone: `+91${buyer.phone}`,
        countryCode: "IN",
      };
      const cartBeforeShipping = await getShopifyCart(cartId, buyerIp);
      if (!cartBeforeShipping || cartBeforeShipping.totalQuantity < 1) return json({ error: "Your bag expired. Add your snacks again to continue." }, 410);

      const delivery = await getShopifyDeliveryOptions(cartId, shopifyAddress, buyerIp);
      const selectionStillValid = deliverySelections.every((selection) => delivery.groups
        .some((group) => group.id === selection.deliveryGroupId && group.options.some((option) => option.handle === selection.deliveryOptionHandle)));
      if (!selectionStillValid) return json({ error: "Delivery choices changed. Refresh and choose a delivery method again." }, 409);
      const selectedQuote = await selectShopifyDeliveryOptions(cartId, deliverySelections, buyerIp);
      const currentCart = await getShopifyCart(cartId, buyerIp);
      if (!currentCart || currentCart.totalQuantity < 1) return json({ error: "Your bag expired. Add your snacks again to continue." }, 410);

      const orderId = createCashfreeOrderId(attemptId);
      const quote = await createCashfreeDraftQuote({
        cart: currentCart,
        deliveryQuote: selectedQuote,
        deliverySelections,
        address: shopifyAddress,
        buyer,
        orderId,
        source,
      });

      let session: CashfreeOrder & { payment_session_id?: string };
      try {
        session = await createCashfreeOrder({
          orderId,
          amount: quote.amount,
          customerId: `beej_${randomUUID().replaceAll("-", "")}`,
          customerName: `${buyer.firstName} ${buyer.lastName}`.trim().slice(0, 100),
          customerEmail: buyer.email,
          customerPhone: buyer.phone,
          returnUrl: `${appOrigin(request)}/checkout/result?order_id={order_id}`,
          notifyUrl: `${appOrigin(request)}/api/webhooks/cashfree`,
          draftOrderId: quote.id,
        }, attemptId);
      } catch (createError) {
        // A timed-out create can still have succeeded. Recover only a matching server-side Cashfree order.
        let existing;
        try { existing = await getCashfreeOrder(orderId); } catch { throw createError; }
        if (!existing.payment_session_id || existing.order_status !== "ACTIVE" || existing.order_currency !== "INR") {
          try { await deleteCashfreeDraftQuote(quote.id); } catch { /* The unused draft remains unpaid. */ }
          throw new CashfreeError("This payment attempt belongs to an earlier checkout. Refresh checkout and start again.", 409);
        }
        session = existing;
      }

      const sessionDraftId = session.order_tags?.shopify_draft_id;
      const validDraftId = typeof sessionDraftId === "string" && sessionDraftId.startsWith("gid://shopify/DraftOrder/");
      const [currentDraft, savedDraft] = validDraftId
        ? await Promise.all([readCashfreeDraftQuote(quote.id), readCashfreeDraftQuote(sessionDraftId)])
        : [null, null];
      const exactDraft = Boolean(currentDraft && savedDraft && (
        sessionDraftId === quote.id || cashfreeDraftMatchesCheckout(savedDraft, currentDraft)
      ));
      if (session.order_id !== orderId || session.order_status !== "ACTIVE" || session.order_currency !== "INR" || !session.payment_session_id
        || !exactDraft || !cashfreeAmountMatches(Number(session.order_amount), quote.amount)) {
        try { await deleteCashfreeDraftQuote(quote.id); } catch { /* Keep the payment failure visible; cleanup is best effort. */ }
        throw new CashfreeError("Cashfree returned a payment session that did not match this Shopify total.", 502);
      }

      if (sessionDraftId !== quote.id) {
        try { await deleteCashfreeDraftQuote(quote.id); } catch { /* The unused duplicate remains an unpaid Shopify draft. */ }
      }
      await storeCashfreeCheckoutSession({
        orderId,
        draftOrderId: sessionDraftId!,
        cartId,
        source,
        expiresAt: Date.now() + 2 * 60 * 60 * 1_000,
      });
      return json({ orderId, paymentSessionId: session.payment_session_id, mode: "sandbox" });
    });
  } catch (error) {
    const result = checkoutPublicError(error);
    if (error instanceof ShopifyCashfreeError && result.status === 500) return json({ error: "Shopify could not prepare this payment. Try again or use Shopify checkout." }, 502);
    return json({ error: result.message }, result.status);
  }
}
