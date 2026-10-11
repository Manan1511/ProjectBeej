import { describe, expect, it } from "vitest";
import {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_FEE,
  assertVariantPurchasable,
  buildShippingEstimate,
  formatINR,
  normalizeQuantity,
  readCartCookie,
  serializeCartCookie,
  totalCartQuantity,
} from "./commerce";
import { withKeyedLock } from "./lock";
import { appendCartLine, createBuyNowCart, trustedCheckoutUrl } from "./cart-actions";
import type { ShopifyCart } from "@/lib/types";

describe("draft shipping estimate", () => {
  it("uses the approved launch defaults below the free-shipping threshold", () => {
    expect(buildShippingEstimate("450.00")).toEqual({
      subtotal: 450,
      fee: SHIPPING_FEE,
      amountUntilFree: 49,
      qualifiesForFreeShipping: false,
    });
  });

  it("uses free shipping at exactly ₹499 and above", () => {
    expect(buildShippingEstimate(String(FREE_SHIPPING_THRESHOLD))).toEqual({
      subtotal: 499,
      fee: 0,
      amountUntilFree: 0,
      qualifiesForFreeShipping: true,
    });
  });

  it("rejects invalid or non-rupee Shopify amount input instead of inventing a total", () => {
    expect(() => buildShippingEstimate("not-money")).toThrow();
    expect(() => buildShippingEstimate("100.50")).toThrow();
  });
});

describe("INR display formatting", () => {
  it("omits .00 for whole-rupee prices but keeps fractional amounts", () => {
    expect(formatINR("299.00")).toBe("₹299");
    expect(formatINR("299.5")).toBe("₹299.5");
  });
});

describe("cart quantity and availability rules", () => {
  it("accepts integer quantities from one through ten", () => {
    expect(normalizeQuantity(1)).toBe(1);
    expect(normalizeQuantity("10")).toBe(10);
  });

  it.each([0, -1, 11, 1.25, "1.5", "lots"]) (
    "rejects quantity %s",
    (quantity) => expect(() => normalizeQuantity(quantity)).toThrow(),
  );

  it("enforces a combined ten-item limit across the Shopify cart", () => {
    expect(() => totalCartQuantity([{ quantity: 4 }, { quantity: 6 }])).not.toThrow();
    expect(() => totalCartQuantity([{ quantity: 5 }, { quantity: 6 }])).toThrow();
  });

  it("prevents unavailable or understocked variants from being purchased", () => {
    expect(() => assertVariantPurchasable({ availableForSale: false }, 1)).toThrow();
    expect(() => assertVariantPurchasable({ availableForSale: true, quantityAvailable: 1 }, 2)).toThrow();
    expect(() => assertVariantPurchasable({ availableForSale: true, quantityAvailable: 3 }, 2)).not.toThrow();
  });
});

describe("private Shopify cart cookie", () => {
  it("keeps the full cart ID including Shopify's key intact", () => {
    const cartId = "gid://shopify/Cart/abc?key=private-value";
    expect(readCartCookie(serializeCartCookie(cartId))).toBe(cartId);
  });

  it("drops malformed cookie values", () => {
    expect(readCartCookie(undefined)).toBeNull();
    expect(readCartCookie("https://example.com/cart")).toBeNull();
  });
});

describe("concurrent cart writes", () => {
  it("serializes mutations for one cart but permits independent carts", async () => {
    const events: string[] = [];
    const delayed = (label: string, ms: number) => withKeyedLock("cart-a", async () => {
      events.push(`${label}-start`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      events.push(`${label}-end`);
    });
    const first = delayed("first", 15);
    const second = delayed("second", 0);
    const independent = withKeyedLock("cart-b", async () => events.push("other-cart"));
    await Promise.all([first, second, independent]);

    expect(events.indexOf("second-start")).toBeGreaterThan(events.indexOf("first-end"));
    expect(events).toContain("other-cart");
  });
});

const cartFixture = (id: string, totalQuantity = 1): ShopifyCart => ({
  id,
  checkoutUrl: "https://projectbeej-1686bmnd.myshopify.com/checkouts/fresh",
  totalQuantity,
  cost: { subtotalAmount: { amount: "299.00", currencyCode: "INR" }, totalAmount: { amount: "299.00", currencyCode: "INR" } },
  lines: totalQuantity ? [{ id: "line-1", quantity: totalQuantity, merchandise: {
    id: "variant-1", title: "Default Title", availableForSale: true, price: { amount: "299.00", currencyCode: "INR" }, selectedOptions: [],
    product: { id: "product-1", title: "Pudina", handle: "pudina", productType: "Roasted Makhana" },
  } }] : [],
});

describe("Shopify cart recovery and Buy Now isolation", () => {
  it("replaces an expired cart with a fresh cart when adding a snack", async () => {
    const calls: string[] = [];
    const fresh = cartFixture("gid://shopify/Cart/fresh");
    const client = {
      getCart: async () => null,
      createCart: async (lines: Array<{ merchandiseId: string; quantity: number }>) => { calls.push(`create:${lines[0]?.merchandiseId}`); return { cart: fresh, userErrors: [], warnings: [] }; },
      addLines: async () => { calls.push("add-lines"); return { cart: null, userErrors: [], warnings: [] }; },
    };
    const result = await appendCartLine(client, "gid://shopify/Cart/expired?key=secret", { merchandiseId: "variant-new", quantity: 1 });

    expect(result.recovered).toBe(true);
    expect(result.cart.id).toBe(fresh.id);
    expect(calls).toEqual(["create:variant-new"]);
  });

  it("uses a fresh, separate cart for Buy Now without touching the saved bag", async () => {
    const bag = "gid://shopify/Cart/saved-bag?key=secret";
    const fresh = cartFixture("gid://shopify/Cart/buy-now", 1);
    const calls: string[] = [];
    const result = await createBuyNowCart(async (lines) => {
      calls.push(`create:${lines[0]?.merchandiseId}`);
      return { cart: fresh, userErrors: [], warnings: [] };
    }, { merchandiseId: "variant-buy-now", quantity: 2 });

    expect(result.cart.id).not.toBe(bag);
    expect(result.cart.id).toContain("buy-now");
    expect(calls).toEqual(["create:variant-buy-now"]);
  });

  it("only accepts HTTPS Shopify checkout hosts", () => {
    expect(trustedCheckoutUrl("https://projectbeej-1686bmnd.myshopify.com/checkouts/abc", "projectbeej-1686bmnd.myshopify.com")).toContain("/checkouts/abc");
    expect(() => trustedCheckoutUrl("http://evil.example/checkout", "projectbeej-1686bmnd.myshopify.com")).toThrow();
  });
});
