import { describe, expect, it, vi } from "vitest";
import { appendCartLine, setCartLineTargets } from "@/lib/cart-actions";
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

const variantA = "gid://shopify/ProductVariant/123";
const variantB = "gid://shopify/ProductVariant/456";

function twoLineCart(quantityA: number, quantityB: number): ShopifyCart {
  const first = cart(quantityA).lines[0];
  const second = {
    ...first,
    id: "line-2",
    quantity: quantityB,
    merchandise: { ...first.merchandise, id: variantB, product: { ...first.merchandise.product, id: "gid://shopify/Product/2", title: "Cheese", handle: "cheese" } },
  };
  return { ...cart(quantityA + quantityB), totalQuantity: quantityA + quantityB, lines: [first, second] };
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

describe("absolute cart quantity batches", () => {
  it("groups updates, removals, and additions into one Shopify mutation", async () => {
    const before = twoLineCart(2, 1);
    const after = { ...before, totalQuantity: 5, lines: [
      { ...before.lines[0]!, quantity: 3 },
      { ...before.lines[1]!, id: "line-3", merchandise: { ...before.lines[1]!.merchandise, id: "gid://shopify/ProductVariant/789" }, quantity: 2 },
    ] };
    const applyTargets = vi.fn(async () => ({ cart: after, userErrors: [], warnings: [] }));
    const result = await setCartLineTargets({
      getCart: async () => before,
      createCart: async () => ({ cart: after, userErrors: [], warnings: [] }),
      applyTargets,
    }, before.id, [
      { variantId: variantA, quantity: 3 },
      { variantId: variantB, quantity: 0 },
      { variantId: "gid://shopify/ProductVariant/789", quantity: 2 },
    ]);

    expect(applyTargets).toHaveBeenCalledTimes(1);
    expect(applyTargets).toHaveBeenCalledWith(before.id, {
      updates: [{ id: "line-1", quantity: 3 }],
      removals: ["line-2"],
      additions: [{ merchandiseId: "gid://shopify/ProductVariant/789", quantity: 2 }],
    });
    expect(result.changes).toEqual([
      { variantId: variantA, previousQuantity: 2, quantity: 3, acceptedQuantity: 1, removedQuantity: 0 },
      { variantId: variantB, previousQuantity: 1, quantity: 0, acceptedQuantity: 0, removedQuantity: 1 },
      { variantId: "gid://shopify/ProductVariant/789", previousQuantity: 0, quantity: 2, acceptedQuantity: 2, removedQuantity: 0 },
    ]);
  });

  it("recovers an expired cart by creating the requested absolute quantities", async () => {
    const createCart = vi.fn(async () => ({ cart: cart(2), userErrors: [], warnings: [{ message: "One item was unavailable." }] }));
    const result = await setCartLineTargets({
      getCart: async () => null,
      createCart,
      applyTargets: async () => ({ cart: null, userErrors: [], warnings: [] }),
    }, "gid://shopify/Cart/expired?key=secret", [{ variantId: variantA, quantity: 2 }]);

    expect(createCart).toHaveBeenCalledWith([{ merchandiseId: variantA, quantity: 2 }]);
    expect(result.recovered).toBe(true);
    expect(result.cart?.totalQuantity).toBe(2);
    expect(result.warnings).toEqual([{ message: "One item was unavailable." }]);
  });

  it("rebases a stale target against cart changes made by another tab", async () => {
    const applyTargets = vi.fn(async (_cartId: string, operations: { updates: Array<{ id: string; quantity: number }>; removals: string[]; additions: Array<{ merchandiseId: string; quantity: number }> }) => ({
      cart: cart(operations.updates[0]?.quantity || 0), userErrors: [], warnings: [],
    }));
    await setCartLineTargets({
      getCart: async () => cart(2),
      createCart: async () => ({ cart: cart(1), userErrors: [], warnings: [] }),
      applyTargets,
    }, "gid://shopify/Cart/current", [{ variantId: variantA, baseQuantity: 1, quantity: 2 }]);

    expect(applyTargets).toHaveBeenCalledWith("gid://shopify/Cart/test?key=private", {
      updates: [{ id: "line-1", quantity: 3 }], removals: [], additions: [],
    });
  });

  it("replays only the pending delta when the old Shopify cart has expired", async () => {
    const createCart = vi.fn(async (lines: Array<{ merchandiseId: string; quantity: number }>) => ({ cart: cart(lines[0]?.quantity || 0), userErrors: [], warnings: [] }));
    const result = await setCartLineTargets({
      getCart: async () => null,
      createCart,
      applyTargets: async () => ({ cart: null, userErrors: [], warnings: [] }),
    }, "gid://shopify/Cart/expired", [{ variantId: variantA, baseQuantity: 2, quantity: 3 }]);

    expect(createCart).toHaveBeenCalledWith([{ merchandiseId: variantA, quantity: 1 }]);
    expect(result.changes[0]?.acceptedQuantity).toBe(1);
  });

  it("rejects a batch that would exceed the combined ten-item limit before mutation", async () => {
    const before = twoLineCart(6, 3);
    const applyTargets = vi.fn();
    await expect(setCartLineTargets({
      getCart: async () => before,
      createCart: async () => ({ cart: before, userErrors: [], warnings: [] }),
      applyTargets,
    }, before.id, [{ variantId: variantA, quantity: 8 }])).rejects.toThrow("up to 10 items");
    expect(applyTargets).not.toHaveBeenCalled();
  });

  it("does not create an empty cart for zero targets", async () => {
    const createCart = vi.fn();
    const result = await setCartLineTargets({
      getCart: async () => null,
      createCart,
      applyTargets: async () => ({ cart: null, userErrors: [], warnings: [] }),
    }, null, [{ variantId: variantA, quantity: 0 }]);
    expect(result.cart).toBeNull();
    expect(createCart).not.toHaveBeenCalled();
  });
});
