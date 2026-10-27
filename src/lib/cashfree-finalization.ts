import "server-only";
import { cashfreeAmountMatches } from "@/lib/cashfree-core";
import { getCashfreeOrder, getCashfreePayments } from "@/lib/cashfree";
import {
  createCashfreeTestOrder,
  findCashfreeShopifyOrder,
  parseCashfreeDraftState,
  readCashfreeDraftQuote,
  updateCashfreeDraftState,
  type CashfreeDraftQuote,
  type CashfreeDraftState,
} from "@/lib/cashfree-shopify";
import { withKeyedLock } from "@/lib/lock";

export type CashfreeFinalizationStatus = "paid" | "pending" | "failed" | "processing";
export type CashfreeFinalizationResult = { status: CashfreeFinalizationStatus; orderName?: string };

const FINALIZATION_LEASE_MS = 2 * 60 * 1_000;

function number(value: unknown): number {
  return typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
}

async function markDraftPaid(draft: CashfreeDraftQuote, orderId: string, paymentId: string, shopifyOrderId: string): Promise<void> {
  const current = await readCashfreeDraftQuote(draft.id);
  if (!current?.state) return;
  const state = parseCashfreeDraftState(current.state.value);
  if (!state || state.orderId !== orderId || state.status === "paid") return;
  const next: CashfreeDraftState = {
    ...state,
    status: "paid",
    updatedAt: new Date().toISOString(),
    paymentId,
    shopifyOrderId,
  };
  await updateCashfreeDraftState({ draft: current, next });
}

export async function finalizeCashfreePayment(orderId: string): Promise<CashfreeFinalizationResult> {
  return withKeyedLock(`cashfree-finalize:${orderId}`, async () => {
    const order = await getCashfreeOrder(orderId);
    if (order.order_id !== orderId || order.order_currency !== "INR" || !Number.isFinite(number(order.order_amount))) {
      return { status: "processing" };
    }

    if (["EXPIRED", "TERMINATED", "FAILED"].includes(order.order_status)) return { status: "failed" };
    if (order.order_status !== "PAID") return { status: "pending" };

    const payments = await getCashfreePayments(orderId);
    const payment = payments.find((candidate) => candidate.payment_status === "SUCCESS"
      && cashfreeAmountMatches(number(candidate.payment_amount), number(order.order_amount))
      && (candidate.payment_currency || "INR") === "INR");
    if (!payment) return { status: "processing" };

    const draftId = order.order_tags?.shopify_draft_id;
    if (!draftId?.startsWith("gid://shopify/DraftOrder/")) return { status: "processing" };
    const draft = await readCashfreeDraftQuote(draftId);
    if (!draft || draft.orderId !== orderId || draft.presentmentCurrencyCode !== "INR"
      || !cashfreeAmountMatches(number(draft.totalPriceSet.presentmentMoney.amount), number(order.order_amount))) {
      return { status: "processing" };
    }

    const existingOrder = await findCashfreeShopifyOrder(orderId);
    if (existingOrder) {
      await markDraftPaid(draft, orderId, String(payment.cf_payment_id), existingOrder.id);
      return { status: "paid", orderName: existingOrder.name };
    }

    if (!draft.state) return { status: "processing" };
    const state = parseCashfreeDraftState(draft.state.value);
    if (!state || state.orderId !== orderId) return { status: "processing" };
    if (state.status === "paid") return { status: "paid" };
    if (state.status === "processing" && Date.now() - Date.parse(state.updatedAt) < FINALIZATION_LEASE_MS) {
      return { status: "processing" };
    }

    const claim: CashfreeDraftState = { ...state, status: "processing", updatedAt: new Date().toISOString() };
    const claimed = await updateCashfreeDraftState({ draft, next: claim });
    if (!claimed) {
      const racedOrder = await findCashfreeShopifyOrder(orderId);
      if (racedOrder) {
        await markDraftPaid(draft, orderId, String(payment.cf_payment_id), racedOrder.id);
        return { status: "paid", orderName: racedOrder.name };
      }
      return { status: "processing" };
    }

    try {
      const created = await createCashfreeTestOrder(draft, orderId, String(payment.cf_payment_id));
      await markDraftPaid(draft, orderId, String(payment.cf_payment_id), created.id);
      return { status: "paid", orderName: created.name };
    } catch {
      // Shopify may have accepted an order before the network failed. Recover by its unique source identifier.
      const recovered = await findCashfreeShopifyOrder(orderId);
      if (recovered) {
        await markDraftPaid(draft, orderId, String(payment.cf_payment_id), recovered.id);
        return { status: "paid", orderName: recovered.name };
      }
      // Keep the compare-digest claim until its lease expires so retries cannot create a duplicate.
      return { status: "processing" };
    }
  });
}
