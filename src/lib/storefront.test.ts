import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUnstableCache = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (...args: unknown[]) => mockUnstableCache(...args) }));

import {
  applyShopifyCartLineTargets,
  addShopifyCartLines,
  createShopifyCart,
  getStorefrontMode,
  getProducts,
  getCardCollectionProducts,
  getCardProducts,
  getFreshShopifyCheckoutUrl,
  getShopifyCart,
  getShopifyCartCount,
  getShopifyCartSnapshot,
  getSiteSettings,
  removeShopifyCartLines,
  updateShopifyCartLines,
} from "./storefront";

const cartLine = {
  id: "line-1",
  quantity: 2,
  merchandise: {
    id: "gid://shopify/ProductVariant/pudina",
    title: "Default Title",
    availableForSale: true,
    quantityAvailable: 8,
    price: { amount: "299.00", currencyCode: "INR" },
    selectedOptions: [],
    product: {
      id: "gid://shopify/Product/pudina",
      title: "Pudina",
      handle: "pudina",
      productType: "Roasted Makhana",
      featuredImage: { url: "https://cdn.shopify.com/pudina.jpg", altText: "Pudina" },
    },
  },
};

const shopifyCart = {
  id: "gid://shopify/Cart/example?key=private",
  checkoutUrl: "https://projectbeej-1686bmnd.myshopify.com/checkouts/example",
  totalQuantity: 2,
  cost: {
    subtotalAmount: { amount: "598.00", currencyCode: "INR" },
    totalAmount: { amount: "598.00", currencyCode: "INR" },
  },
  lines: { nodes: [cartLine] },
};

function respondWith(data: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 })));
}

const shopifyMutation = { cart: shopifyCart, userErrors: [], warnings: [] };
const publishedShopifyProduct = {
  id: "gid://shopify/Product/pudina",
  handle: "pudina",
  title: "Pudina",
  description: "Minty roasted makhana.",
  descriptionHtml: "<p>Minty roasted makhana.</p>",
  productType: "Roasted Makhana",
  availableForSale: true,
  featuredImage: { url: "https://cdn.shopify.com/pudina.jpg", altText: "Pudina" },
  images: { nodes: [{ url: "https://cdn.shopify.com/pudina.jpg", altText: "Pudina" }] },
  priceRange: { minVariantPrice: { amount: "299.00", currencyCode: "INR" } },
  variants: { nodes: [{ id: "gid://shopify/ProductVariant/pudina", title: "Default Title", availableForSale: true, quantityAvailable: 10, price: { amount: "299.00", currencyCode: "INR" }, selectedOptions: [] }] },
  collections: { nodes: [{ handle: "roasted-makhana" }] },
  beejFaqs: null,
  beejApprovedReviews: null,
};

describe("Shopify cart response mapping", () => {
  beforeEach(() => {
    mockUnstableCache.mockImplementation((callback) => callback);
    vi.stubEnv("SHOPIFY_STOREFRONT_PUBLIC_TOKEN", "test-storefront-token");
    vi.stubEnv("SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { cart: shopifyCart } }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps production in preview until live Shopify mode is explicitly enabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHOPIFY_MODE", "");
    expect(getStorefrontMode()).toBe("preview");
    vi.stubEnv("SHOPIFY_MODE", "live");
    expect(getStorefrontMode()).toBe("live");
  });

  it("sends the public Storefront token with Shopify's required header and marks catalog products live", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { products: { nodes: [publishedShopifyProduct] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const [product] = await getProducts();
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(new Headers(request.headers).get("x-shopify-storefront-access-token")).toBe("test-storefront-token");
    expect(new Headers(request.headers).get("shopify-storefront-access-token")).toBeNull();
    expect(product).toMatchObject({ handle: "pudina", preview: false, availableForSale: true });
    expect(mockUnstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      expect.arrayContaining(["project-beej-public-storefront", "projectbeej-1686bmnd.myshopify.com", "2026-10", "live"]),
      { revalidate: 60 },
    );
  });

  it("validates catalog products inside the cached function so malformed data cannot become a cached success", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { products: { nodes: [{ id: "incomplete-product" }] } } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getCardProducts()).rejects.toThrow("Shopify returned incomplete product data.");
    const cachedLoader = mockUnstableCache.mock.calls.at(-1)?.[0] as (() => Promise<unknown>) | undefined;
    await expect(cachedLoader?.()).rejects.toThrow("Shopify returned incomplete product data.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("caches only validated public settings with the publish invalidation tag", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    respondWith({ shop: { id: "gid://shopify/Shop/1", paymentSettings: { currencyCode: "INR" }, storefrontSettings: { value: JSON.stringify({
      contentVersion: 1,
      visibility: { homeAthletes: false, newsletter: true, privateDraft: true },
      shopCopy: { heroTitle: "Shop all", ignored: "must not load" },
      aboutCopy: { heroTitleLineOne: "Rooted in nature." },
      footerCopy: { tagline: "Rooted in nature. Growing with purpose." },
    }) } } });

    const settings = await getSiteSettings();

    expect(settings).toMatchObject({
      contentVersion: 1,
      visibility: { homeAthletes: false, newsletter: true },
      shopCopy: { heroTitle: "Shop all" },
      aboutCopy: { heroTitleLineOne: "Rooted in nature." },
      footerCopy: { tagline: "Rooted in nature. Growing with purpose." },
    });
    expect(settings.visibility).not.toHaveProperty("privateDraft");
    expect(settings.shopCopy).not.toHaveProperty("ignored");
    expect(mockUnstableCache.mock.calls.at(-1)?.[2]).toEqual({ revalidate: 60, tags: ["storefront-settings"] });
  });

  it("keeps a failed Shopify catalog read distinct from a successful empty catalog", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: "Temporary Shopify outage." }] }), { status: 200 })));

    await expect(getCardProducts()).rejects.toThrow("Temporary Shopify outage.");
  });

  it("treats a genuinely missing collection as an empty collection", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    respondWith({ collection: null });

    await expect(getCardCollectionProducts("not-a-collection")).resolves.toEqual([]);
  });

  it("does not request inventory counts from Shopify product or cart queries", async () => {
    vi.stubEnv("SHOPIFY_MODE", "live");
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { query: string };
      expect(body.query).not.toContain("quantityAvailable");
      return new Response(JSON.stringify({ data: body.query.includes("BeejCart") ? { cart: shopifyCart } : { products: { nodes: [publishedShopifyProduct] } } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await getProducts();
    await getShopifyCart(shopifyCart.id);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns cart lines as an array from Shopify's lines connection", async () => {
    respondWith({ cart: shopifyCart });
    const cart = await getShopifyCart(shopifyCart.id);

    expect(cart?.lines).toEqual([cartLine]);
  });

  it("uses a lean cart snapshot for quantity validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      cart: { totalQuantity: 2, lines: { nodes: [{ id: "line-1", quantity: 2, merchandise: { id: cartLine.merchandise.id } }] } },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await getShopifyCartSnapshot(shopifyCart.id);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { query: string };

    expect(snapshot).toEqual({ totalQuantity: 2, lines: [{ id: "line-1", quantity: 2, merchandise: { id: cartLine.merchandise.id } }] });
    expect(request.query).toContain("totalQuantity");
    expect(request.query).not.toContain("featuredImage");
    expect(request.query).not.toContain("subtotalAmount");
  });

  it("loads just the fields used by product cards", async () => {
    respondWith({ products: { nodes: [publishedShopifyProduct] } });

    const [product] = await getCardProducts();
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { query: string };

    expect(product).toMatchObject({ handle: "pudina", images: [{ url: "https://cdn.shopify.com/pudina.jpg" }] });
    expect(request.query).toContain("images(first: 2)");
    expect(request.query).not.toContain("descriptionHtml");
    expect(request.query).not.toContain("beejFaqs");
    expect(request.query).not.toContain("collections(first:");
  });

  it("uses the card field selection for collection product grids", async () => {
    respondWith({ collection: { products: { nodes: [publishedShopifyProduct] } } });

    const [product] = await getCardCollectionProducts("roasted-makhana");
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { query: string; variables: Record<string, unknown> };

    expect(product?.handle).toBe("pudina");
    expect(request.query).toContain("images(first: 2)");
    expect(request.query).not.toContain("beejApprovedReviews");
    expect(request.variables.handle).toBe("roasted-makhana");
  });

  it("loads only the cart quantity for the site header", async () => {
    respondWith({ cart: { totalQuantity: 7 } });

    await expect(getShopifyCartCount(shopifyCart.id)).resolves.toBe(7);
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as { query: string };
    expect(request.query).toContain("totalQuantity");
    expect(request.query).not.toContain("lines(");
  });

  it("returns cart lines as an array after creating a cart", async () => {
    respondWith({ cartCreate: shopifyMutation });
    const result = await createShopifyCart([{ merchandiseId: cartLine.merchandise.id, quantity: 2 }]);

    expect(result.cartCreate.cart?.lines).toEqual([cartLine]);
  });

  it("returns cart lines as an array after adding lines", async () => {
    respondWith({ cartLinesAdd: shopifyMutation });
    const result = await addShopifyCartLines(shopifyCart.id, [{ merchandiseId: cartLine.merchandise.id, quantity: 2 }]);

    expect(result.cartLinesAdd.cart?.lines).toEqual([cartLine]);
  });

  it("returns cart lines as an array after updating lines", async () => {
    respondWith({ cartLinesUpdate: shopifyMutation });
    const result = await updateShopifyCartLines(shopifyCart.id, [{ id: cartLine.id, quantity: 2 }]);

    expect(result.cartLinesUpdate.cart?.lines).toEqual([cartLine]);
  });

  it("returns cart lines as an array after removing lines", async () => {
    respondWith({ cartLinesRemove: shopifyMutation });
    const result = await removeShopifyCartLines(shopifyCart.id, [cartLine.id]);

    expect(result.cartLinesRemove.cart?.lines).toEqual([cartLine]);
  });

  it("groups absolute line updates, removals, and additions into one Shopify request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      updated: { cart: shopifyCart, userErrors: [], warnings: [] },
      removed: { cart: shopifyCart, userErrors: [], warnings: [{ message: "A line was removed." }] },
      added: { cart: shopifyCart, userErrors: [], warnings: [] },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await applyShopifyCartLineTargets(shopifyCart.id, {
      updates: [{ id: "line-1", quantity: 3 }],
      removals: ["line-2"],
      additions: [{ merchandiseId: "gid://shopify/ProductVariant/new", quantity: 1 }],
    });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { query: string; variables: Record<string, unknown> };

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(request.query).toContain("updated: cartLinesUpdate");
    expect(request.query).toContain("removed: cartLinesRemove");
    expect(request.query).toContain("added: cartLinesAdd");
    expect(request.variables).toEqual({
      cartId: shopifyCart.id,
      updates: [{ id: "line-1", quantity: 3 }],
      lineIds: ["line-2"],
      additions: [{ merchandiseId: "gid://shopify/ProductVariant/new", quantity: 1 }],
    });
    expect(result).toMatchObject({ cart: { lines: [cartLine] }, userErrors: [], warnings: [{ message: "A line was removed." }] });
  });

  it("marks published Shopify products as preview-only while storefront preview mode is active", async () => {
    vi.stubEnv("SHOPIFY_MODE", "preview");
    respondWith({ products: { nodes: [publishedShopifyProduct] } });

    const [product] = await getProducts();

    expect(product?.preview).toBe(true);
  });

  it("uses fresh Shopify checkout data with consent passed in Storefront context", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      expect(request.query).toContain("@inContext(visitorConsent:");
      expect(request.variables).toMatchObject({ analytics: true, marketing: false, preferences: true });
      expect(request.variables.id).toBe("gid://shopify/Cart/c1?key=private");
      return new Response(JSON.stringify({ data: { cart: { checkoutUrl: "https://projectbeej-1686bmnd.myshopify.com/checkouts/c1" } } }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const url = await getFreshShopifyCheckoutUrl("gid://shopify/Cart/c1?key=private", { analytics: true, marketing: false, preferences: true });
    expect(url).toBe("https://projectbeej-1686bmnd.myshopify.com/checkouts/c1");
  });
});
