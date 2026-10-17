import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShopifyCart } from "@/lib/types";

const mocks = vi.hoisted(() => ({
  readCartId: vi.fn(),
  storeCartId: vi.fn(),
  clearCartId: vi.fn(),
  requestBuyerIp: vi.fn(),
  getShopifyCart: vi.fn(),
  createShopifyCart: vi.fn(),
  applyShopifyCartLineTargets: vi.fn(),
  getStorefrontMode: vi.fn(),
  withKeyedLock: vi.fn(async (_key: string, operation: () => Promise<unknown>) => operation()),
  cartAliases: new Map<string, string>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cart-cookie", () => ({ readStoredCartId: mocks.readCartId, storeCartId: mocks.storeCartId, clearStoredCartId: mocks.clearCartId }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: mocks.requestBuyerIp }));
vi.mock("@/lib/storefront", () => ({
  getShopifyCart: mocks.getShopifyCart,
  createShopifyCart: mocks.createShopifyCart,
  applyShopifyCartLineTargets: mocks.applyShopifyCartLineTargets,
  getStorefrontMode: mocks.getStorefrontMode,
}));
vi.mock("@/lib/lock", () => ({
  withKeyedLock: mocks.withKeyedLock,
  getClientCartAlias: (key?: string) => key ? mocks.cartAliases.get(key) || null : null,
  setClientCartAlias: (key: string | undefined, cartId: string) => { if (key) mocks.cartAliases.set(key, cartId); },
  clearClientCartAlias: (key?: string) => { if (key) mocks.cartAliases.delete(key); },
}));

import { NextRequest } from "next/server";
import { GET as readCart } from "./route";
import { PUT as updateCart } from "./lines/route";

const id = "gid://shopify/Cart/cart?key=private";
const variantId = "gid://shopify/ProductVariant/123";

function cart(quantity: number): ShopifyCart {
  return {
    id,
    checkoutUrl: "https://example.myshopify.com/checkout?key=private",
    totalQuantity: quantity,
    cost: { subtotalAmount: { amount: String(quantity * 100), currencyCode: "INR" }, totalAmount: { amount: String(quantity * 100), currencyCode: "INR" } },
    lines: quantity ? [{ id: "line-1", quantity, merchandise: { id: variantId, title: "Default Title", availableForSale: true, price: { amount: "100", currencyCode: "INR" }, selectedOptions: [], product: { id: "gid://shopify/Product/1", title: "Pudina", handle: "pudina", productType: "Roasted Makhana" } } }] : [],
  };
}

function putRequest(body: unknown) {
  return new NextRequest("http://localhost/api/cart/lines", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

describe("private cart endpoints", () => {
  beforeEach(() => {
    mocks.readCartId.mockResolvedValue(id);
    mocks.storeCartId.mockResolvedValue(undefined);
    mocks.clearCartId.mockResolvedValue(undefined);
    mocks.requestBuyerIp.mockResolvedValue(undefined);
    mocks.getShopifyCart.mockResolvedValue(cart(1));
    mocks.createShopifyCart.mockResolvedValue({ cartCreate: { cart: cart(1), userErrors: [], warnings: [] } });
    mocks.applyShopifyCartLineTargets.mockResolvedValue({ cart: cart(2), userErrors: [], warnings: [] });
    mocks.getStorefrontMode.mockReturnValue("live");
    mocks.cartAliases.clear();
  });

  afterEach(() => vi.clearAllMocks());

  it("reads the cookie cart without exposing Shopify's private cart key", async () => {
    const response = await readCart();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.cart.id).toBe("gid://shopify/Cart/cart");
    expect(body.cart.checkoutUrl).toBe("");
    expect(JSON.stringify(body)).not.toContain("key=private");
  });

  it("applies a batch of absolute quantities and returns Shopify's accepted changes", async () => {
    const response = await updateCart(putRequest({ targets: [{ variantId, quantity: 2 }], clientKey: "browser-session-123" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.applyShopifyCartLineTargets).toHaveBeenCalledTimes(1);
    expect(mocks.applyShopifyCartLineTargets.mock.calls[0]?.[1]).toMatchObject({ updates: [{ id: "line-1", quantity: 2 }] });
    expect(body.cart.totalQuantity).toBe(2);
    expect(mocks.storeCartId).toHaveBeenCalledWith(id);
  });

  it("does not delete the known bag when Shopify cannot be read", async () => {
    mocks.getShopifyCart.mockRejectedValueOnce(new Error("Shopify unavailable."));
    const response = await readCart();
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Your bag could not be loaded. Try again.");
    expect(mocks.clearCartId).not.toHaveBeenCalled();
  });

  it("reuses the first bag when two tabs submit before the new cookie arrives", async () => {
    const clientKey = "shared-browser-session";
    mocks.readCartId.mockResolvedValue(null);
    mocks.createShopifyCart.mockResolvedValue({ cartCreate: { cart: cart(1), userErrors: [], warnings: [] } });
    mocks.getShopifyCart.mockResolvedValue(cart(1));
    mocks.applyShopifyCartLineTargets.mockResolvedValue({ cart: cart(2), userErrors: [], warnings: [] });

    await updateCart(putRequest({ targets: [{ variantId, quantity: 1, baseQuantity: 0 }], clientKey }));
    await updateCart(putRequest({ targets: [{ variantId, quantity: 1, baseQuantity: 0 }], clientKey }));

    expect(mocks.createShopifyCart).toHaveBeenCalledTimes(1);
    expect(mocks.getShopifyCart).toHaveBeenCalledWith(id, undefined);
    expect(mocks.applyShopifyCartLineTargets.mock.calls[0]?.[1]).toMatchObject({ updates: [{ id: "line-1", quantity: 2 }] });
    expect(mocks.withKeyedLock).toHaveBeenNthCalledWith(1, `new-cart:${clientKey}`, expect.any(Function));
    expect(mocks.withKeyedLock).toHaveBeenNthCalledWith(2, `new-cart:${clientKey}`, expect.any(Function));
  });
});
