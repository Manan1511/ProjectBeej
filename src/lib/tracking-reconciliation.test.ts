import { describe, expect, it } from "vitest";
import { deterministicReconciliationDeliveryId, mapReconciledOrder } from "@/lib/tracking-reconciliation";

describe("Shopify reconciliation mapping", () => {
  it("maps only order fields needed for revenue attribution and preserves custom cart context", () => {
    const normalized = mapReconciledOrder({
      id: "gid://shopify/Order/1", legacyResourceId: "1", displayFinancialStatus: "PAID", currencyCode: "INR", test: false,
      totalPriceSet: { shopMoney: { amount: "348.00", currencyCode: "INR" } },
      subtotalPriceSet: { shopMoney: { amount: "299.00", currencyCode: "INR" } },
      totalShippingPriceSet: { shopMoney: { amount: "49.00", currencyCode: "INR" } },
      totalTaxSet: { shopMoney: { amount: "0.00", currencyCode: "INR" } },
      customAttributes: [{ key: "beej_tracking_context", value: "v1.example" }, { key: "note", value: "not copied to analytics" }],
      lineItems: { nodes: [{ title: "Pudina", quantity: 2, originalUnitPriceSet: { shopMoney: { amount: "299" } }, discountedTotalSet: { shopMoney: { amount: "500" } }, variant: { legacyResourceId: "44" } }] },
    });
    expect(normalized).toMatchObject({ financial_status: "paid", currency: "INR", current_total_price_set: { shopMoney: { amount: "348.00" } }, line_items: [{ variant_id: "44", price: "299.00", total_discount: "98.00" }], note_attributes: [{ name: "beej_tracking_context", value: "v1.example" }] });
  });

  it("creates stable valid UUIDs for idempotent reconciliation deliveries", () => {
    const first = deterministicReconciliationDeliveryId("orders/paid", "gid://shopify/Order/123");
    expect(first).toBe(deterministicReconciliationDeliveryId("orders/paid", "gid://shopify/Order/123"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
