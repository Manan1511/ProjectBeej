import "server-only";
import {
  CASHFREE_SANDBOX_API,
  CashfreeError,
  getCashfreeConfig,
  type CashfreeConfig,
  type CashfreeOrder,
  type CashfreePayment,
} from "@/lib/cashfree-core";

type CashfreeCreateOrderInput = {
  orderId: string;
  amount: number;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  returnUrl: string;
  notifyUrl: string;
  draftOrderId: string;
};

type CashfreeSessionResponse = CashfreeOrder & { payment_session_id: string };

function config(): CashfreeConfig {
  const value = getCashfreeConfig();
  if (!value) throw new CashfreeError("Cashfree sandbox is not configured.", 503);
  return value;
}

async function cashfreeRequest<T>(path: string, init: RequestInit = {}, requestId?: string): Promise<T> {
  const credentials = config();
  let response: Response;
  try {
    response = await fetch(`${CASHFREE_SANDBOX_API}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "Content-Type": "application/json",
        "x-api-version": credentials.apiVersion,
        "x-client-id": credentials.appId,
        "x-client-secret": credentials.secretKey,
        ...(requestId ? { "x-idempotency-key": requestId } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new CashfreeError("Cashfree sandbox did not return a response.");
  }

  if (!response.ok) {
    if (response.status === 409) throw new CashfreeError("This payment attempt already exists. Refresh checkout and try again.", 409);
    if (response.status === 429) throw new CashfreeError("Cashfree is receiving too many requests. Try again shortly.", 429);
    throw new CashfreeError("Cashfree sandbox could not process the payment request.", response.status >= 500 ? 502 : 422);
  }

  try {
    return await response.json() as T;
  } catch {
    throw new CashfreeError("Cashfree sandbox returned an invalid response.");
  }
}

export async function createCashfreeOrder(input: CashfreeCreateOrderInput, idempotencyKey: string): Promise<CashfreeSessionResponse> {
  const payload = {
    order_id: input.orderId,
    order_amount: input.amount,
    order_currency: "INR",
    customer_details: {
      customer_id: input.customerId,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
    },
    order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
    order_note: "Project Beej sandbox checkout",
    order_tags: { shopify_draft_id: input.draftOrderId },
  };
  return cashfreeRequest<CashfreeSessionResponse>("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export async function getCashfreeOrder(orderId: string): Promise<CashfreeOrder> {
  if (!/^beej_[a-f0-9]{32}$/.test(orderId)) throw new CashfreeError("Invalid Cashfree order ID.", 400);
  return cashfreeRequest<CashfreeOrder>(`/orders/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export async function getCashfreePayments(orderId: string): Promise<CashfreePayment[]> {
  if (!/^beej_[a-f0-9]{32}$/.test(orderId)) throw new CashfreeError("Invalid Cashfree order ID.", 400);
  const result = await cashfreeRequest<CashfreePayment[] | { data?: CashfreePayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`, { method: "GET" });
  if (Array.isArray(result)) return result;
  return Array.isArray(result.data) ? result.data : [];
}
