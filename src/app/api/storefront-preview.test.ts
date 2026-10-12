import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/cart-cookie", () => ({
  clearStoredCartId: vi.fn(async () => undefined),
  readStoredCartId: vi.fn(async () => "gid://shopify/Cart/test?key=private"),
  storeCartId: vi.fn(async () => undefined),
}));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));

import { NextRequest } from "next/server";
import { POST as addCartLine, PATCH as updateCartLine, DELETE as removeCartLine } from "./cart/lines/route";
import { POST as checkout } from "./cart/checkout/route";
import { POST as buyNow } from "./buy-now/route";

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("preview-mode purchase protection", () => {
  beforeEach(() => {
    vi.stubEnv("SHOPIFY_MODE", "preview");
    vi.stubEnv("SHOPIFY_STOREFRONT_PUBLIC_TOKEN", "");
    vi.stubEnv("SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("blocks adding a cart line", async () => {
    const response = await addCartLine(jsonRequest("/api/cart/lines", { variantId: "variant-1", quantity: 1 }));

    expect(response.status).toBe(503);
  });

  it("blocks updating a cart line", async () => {
    const response = await updateCartLine(jsonRequest("/api/cart/lines", { lineId: "line-1", quantity: 2 }));

    expect(response.status).toBe(503);
  });

  it("blocks removing a cart line", async () => {
    const request = new NextRequest("http://localhost/api/cart/lines?lineId=line-1", { method: "DELETE" });
    const response = await removeCartLine(request);

    expect(response.status).toBe(503);
  });

  it("blocks Shopify checkout", async () => {
    const response = await checkout();

    expect(response.status).toBe(503);
  });

  it("blocks Buy now checkout", async () => {
    const response = await buyNow(jsonRequest("/api/buy-now", { variantId: "variant-1", quantity: 1 }));

    expect(response.status).toBe(503);
  });
});
