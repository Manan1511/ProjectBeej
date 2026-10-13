import { describe, expect, it } from "vitest";
import { buildPurchaseOutboxEvents, buildRefundOutboxEvents } from "@/lib/tracking-conversions";
import type { StoredCheckoutContext } from "@/lib/tracking-store";

const config = {
  ga4MeasurementId: "G-TEST123",
  ga4ApiSecret: "measurement-secret",
  metaPixelId: "1234567890",
  metaAccessToken: "meta-test-token",
  metaApiVersion: "v99.0",
  siteUrl: "https://beej.example",
};
const context: StoredCheckoutContext = {
  context_id: "ctx", visitor_id: "visitor",
  consent: { analytics: true, marketing: true, preferences: false },
  attribution: null,
  identifiers: { clientId: "123.456", sessionId: "456", fbp: "fb.1.2", fbc: "fb.1.3" },
  client_ip: "192.0.2.1", user_agent: "browser/1",
};
const order = {
  id: 987,
  name: "#Beej1001",
  test: false,
  processed_at: "2026-10-13T10:00:00.000Z",
  currency: "INR",
  current_subtotal_price_set: { shop_money: { amount: "299.00", currency_code: "INR" } },
  current_total_price_set: { shop_money: { amount: "348.00", currency_code: "INR" } },
  current_total_shipping_price_set: { shop_money: { amount: "49.00", currency_code: "INR" } },
  current_total_tax: "0.00",
  line_items: [{ variant_id: 123, title: "Pudina", quantity: 1, price: "349.00", total_discount: "50.00" }],
};

describe("Shopify paid-order conversions", () => {
  it("uses discounted merchandise for GA4 and charged total for Meta", () => {
    const events = buildPurchaseOutboxEvents(order, context, config, new Date("2026-10-13T10:05:00.000Z"));
    expect(events.map((event) => event.provider)).toEqual(["ga4", "meta"]);
    const ga = events[0]!.payload as { client_id: string; events: Array<{ params: Record<string, unknown> }> };
    expect(ga.client_id).toBe("123.456");
    expect(ga.events[0]?.params).toMatchObject({ transaction_id: "987", value: 299, shipping: 49, tax: 0 });
    expect((ga.events[0]?.params.items as Array<Record<string, unknown>>)[0]).toMatchObject({ item_id: "beej_123", price: 299 });
    const meta = events[1]!.payload as { data: Array<{ custom_data: Record<string, unknown>; user_data: Record<string, unknown> }> };
    expect(meta.data[0]?.custom_data).toMatchObject({ value: 348, currency: "INR", order_id: "987" });
    expect(meta.data[0]?.user_data).toMatchObject({ fbp: "fb.1.2", fbc: "fb.1.3", client_ip_address: "192.0.2.1" });
    expect(JSON.stringify(meta)).not.toMatch(/email|phone|Beej1001/);
  });

  it("does not queue events without matching consent or actual GA client identity", () => {
    expect(buildPurchaseOutboxEvents(order, { ...context, consent: { analytics: false, marketing: false, preferences: false } }, config)).toEqual([]);
    expect(buildPurchaseOutboxEvents(order, { ...context, identifiers: {}, client_ip: null, user_agent: null }, { ...config, ga4MeasurementId: "", metaPixelId: "" })).toEqual([]);
  });

  it("rejects test orders and orders outside provider event windows", () => {
    expect(buildPurchaseOutboxEvents({ ...order, test: true }, context, config)).toEqual([]);
    expect(buildPurchaseOutboxEvents(order, context, config, new Date("2026-10-21T10:00:00.000Z"))).toEqual([]);
  });
});

describe("Shopify refund conversions", () => {
  const orderTracking = { transaction_id: "987", currency: "INR", identifiers: { clientId: "123.456" }, consent: { analytics: true, marketing: false, preferences: false }, test_order: false };
  const refund = {
    id: 765,
    processed_at: "2026-10-13T10:00:00.000Z",
    transactions: [{ status: "success", amount: "118.00" }],
    refund_line_items: [{ subtotal: "100.00", quantity: 1, line_item: { variant_id: 123, title: "Pudina" } }],
  };

  it("waits for successful refund money and excludes refunded tax and shipping", () => {
    const pending = buildRefundOutboxEvents({ ...refund, transactions: [{ status: "pending", amount: "118.00" }] }, orderTracking, config, new Date("2026-10-13T10:05:00.000Z"));
    expect(pending.status).toBe("pending");
    const result = buildRefundOutboxEvents(refund, orderTracking, config, new Date("2026-10-13T10:05:00.000Z"));
    expect(result.status).toBe("succeeded");
    expect(result.events[0]?.event_id).toBe("shopify_refund_765_refund");
    expect((result.events[0]?.payload.events as Array<{ params: Record<string, unknown> }>)[0]?.params).toMatchObject({ transaction_id: "987", value: 100, currency: "INR" });
  });

  it("sends no refund for failed, mixed, unconsented, or stale transactions", () => {
    expect(buildRefundOutboxEvents({ ...refund, transactions: [{ status: "failure" }] }, orderTracking, config).status).toBe("failed");
    expect(buildRefundOutboxEvents({ ...refund, transactions: [{ status: "success" }, { status: "pending" }] }, orderTracking, config).status).toBe("manual");
    expect(buildRefundOutboxEvents(refund, { ...orderTracking, consent: { analytics: false, marketing: false, preferences: false } }, config).events).toEqual([]);
    expect(buildRefundOutboxEvents(refund, orderTracking, config, new Date("2026-10-17T10:00:00.000Z")).status).toBe("manual");
  });
});
