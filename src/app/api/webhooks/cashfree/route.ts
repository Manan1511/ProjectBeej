import { NextRequest, NextResponse } from "next/server";
import { getCashfreeConfig, verifyCashfreeWebhook } from "@/lib/cashfree-core";
import { cashfreeCheckoutConfigured } from "@/lib/cashfree-core";
import { finalizeCashfreePayment } from "@/lib/cashfree-finalization";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function readOrderId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data as Record<string, unknown> : null;
  const order = data?.order && typeof data.order === "object" && !Array.isArray(data.order) ? data.order as Record<string, unknown> : null;
  const payment = data?.payment && typeof data.payment === "object" && !Array.isArray(data.payment) ? data.payment as Record<string, unknown> : null;
  const orderId = order?.order_id ?? root.order_id ?? payment?.order_id;
  return typeof orderId === "string" && /^beej_[a-f0-9]{32}$/.test(orderId) ? orderId : null;
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* The request is already too large. */ }
        return null;
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (!cashfreeCheckoutConfigured()) return json({ error: "Cashfree checkout is not configured." }, 503);
  const timestamp = request.headers.get("x-webhook-timestamp") || "";
  const signature = request.headers.get("x-webhook-signature") || "";
  const rawBody = await readBoundedBody(request, 64_000);
  if (rawBody === null) return json({ error: "Webhook payload is too large or unreadable." }, 413);
  const config = getCashfreeConfig();
  if (!config || !verifyCashfreeWebhook(rawBody, timestamp, signature, config.secretKey)) return json({ error: "Invalid webhook signature." }, 401);

  try {
    const payload = JSON.parse(rawBody) as unknown;
    const orderId = readOrderId(payload);
    if (!orderId) return json({ error: "Invalid webhook order ID." }, 400);
    await finalizeCashfreePayment(orderId);
    return json({ received: true });
  } catch {
    // Return a failure only when the signed event could not be processed, allowing Cashfree to retry.
    return json({ error: "Payment event could not be reconciled." }, 503);
  }
}
