import { describe, expect, it } from "vitest";
import { optimisticCartQuantity } from "./cart-optimism";
import type { ShopifyCart } from "@/lib/types";

const cart: ShopifyCart = {
  id: "cart-1",
  checkoutUrl: "https://shopify.test/checkout",
  totalQuantity: 3,
  cost: { subtotalAmount: { amount: "900", currencyCode: "INR" }, totalAmount: { amount: "900", currencyCode: "INR" } },
  lines: [
    { id: "line-a", quantity: 2, merchandise: { id: "variant-a", title: "Jar", availableForSale: true, price: { amount: "300", currencyCode: "INR" }, selectedOptions: [], product: { id: "product-a", title: "Peri Peri", handle: "peri-peri", productType: "Roasted Makhana" } } },
    { id: "line-b", quantity: 1, merchandise: { id: "variant-b", title: "Jar", availableForSale: true, price: { amount: "300", currencyCode: "INR" }, selectedOptions: [], product: { id: "product-b", title: "Cheese", handle: "cheese", productType: "Roasted Makhana" } } },
  ],
};

describe("optimistic cart quantity updates", () => {
  it("updates the displayed line and count without guessing Shopify totals", () => {
    const updated = optimisticCartQuantity(cart, "line-a", 3);

    expect(updated.lines[0]?.quantity).toBe(3);
    expect(updated.totalQuantity).toBe(4);
    expect(updated.cost).toEqual(cart.cost);
    expect(cart.lines[0]?.quantity).toBe(2);
  });

  it("removes a line optimistically when its quantity reaches zero", () => {
    const updated = optimisticCartQuantity(cart, "line-a", 0);

    expect(updated.lines.map((line) => line.id)).toEqual(["line-b"]);
    expect(updated.totalQuantity).toBe(1);
  });
});
