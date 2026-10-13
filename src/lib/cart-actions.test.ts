import { describe, expect, it } from "vitest";
import { appendCartLine } from "@/lib/cart-actions";
import type { ShopifyCart } from "@/lib/types";

function cart(quantity: number): ShopifyCart {
  return {
    id: "gid://shopify/Cart/test?key=private",
    checkoutUrl: "https://projectbeej-1686bmnd.myshopify.com/checkouts/test",
    totalQuantity: quantity,
    cost: { subtotalAmount: { amount: "100", currencyCode: "INR" }, totalAmount: { amount: "100", currencyCode: "INR" } },
    lines: quantity ? [{
      id: "line-1", quantity,
      merchandise: {
        id: "gid://shopify/ProductVariant/123", title: "Default Title", availableForSale: true,
        price: { amount: "100", currencyCode: "INR" }, selectedOptions: [],
        product: { id: "gid://shopify/Product/1", title: "Pudina", handle: "pudina", productType: "Roasted Makhana" },
      },
    }] : [],
  };
}

describe("accepted Shopify cart quantities", () => {
  it("reports only the quantity Shopify actually accepted", async () => {
    const result = await appendCartLine({
      getCart: async () => cart(2),
      createCart: async () => ({ cart: cart(1), userErrors: [], warnings: [] }),
      addLines: async () => ({ cart: cart(3), userErrors: [], warnings: [{ message: "Only one item remains." }] }),
    }, "gid://shopify/Cart/old?key=secret", { merchandiseId: "gid://shopify/ProductVariant/123", quantity: 4 });

    expect(result.addedQuantity).toBe(1);
  });

  it("reports zero when Shopify did not increase the requested variant", async () => {
    const result = await appendCartLine({
      getCart: async () => cart(2),
      createCart: async () => ({ cart: cart(1), userErrors: [], warnings: [] }),
      addLines: async () => ({ cart: cart(2), userErrors: [], warnings: [{ message: "Unavailable." }] }),
    }, "gid://shopify/Cart/old?key=secret", { merchandiseId: "gid://shopify/ProductVariant/123", quantity: 1 });

    expect(result.addedQuantity).toBe(0);
  });
});
