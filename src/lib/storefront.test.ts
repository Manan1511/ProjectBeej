import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  addShopifyCartLines,
  createShopifyCart,
  getProducts,
  getShopifyCart,
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
    vi.stubEnv("SHOPIFY_STOREFRONT_PUBLIC_TOKEN", "test-storefront-token");
    vi.stubEnv("SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { cart: shopifyCart } }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns cart lines as an array from Shopify's lines connection", async () => {
    respondWith({ cart: shopifyCart });
    const cart = await getShopifyCart(shopifyCart.id);

    expect(cart?.lines).toEqual([cartLine]);
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

  it("marks published Shopify products as preview-only while storefront preview mode is active", async () => {
    vi.stubEnv("SHOPIFY_MODE", "preview");
    respondWith({ products: { nodes: [publishedShopifyProduct] } });

    const [product] = await getProducts();

    expect(product?.preview).toBe(true);
  });
});
