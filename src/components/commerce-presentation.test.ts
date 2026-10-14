import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BeejProduct, ShopifyCart } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { ProductDetail } from "@/components/ProductDetail";
import { ProductGrid } from "@/components/ProductGrid";
import { CartPanel } from "@/components/CartPanel";

function product(preview: boolean, availableForSale: boolean): BeejProduct {
  return {
    id: "gid://shopify/Product/121",
    handle: "pudina",
    title: "Pudina",
    description: "A Shopify-managed product description.",
    productType: "Roasted Makhana",
    images: [{ url: "/assets/pudina-pop.jpg", alt: "Pudina snack pack" }],
    variants: [{
      id: "gid://shopify/ProductVariant/801234567",
      title: "30 g pouch",
      availableForSale,
      price: { amount: "417.00", currencyCode: "INR" },
      selectedOptions: [{ name: "Size", value: "30 g pouch" }],
    }],
    price: { amount: "417.00", currencyCode: "INR" },
    availableForSale,
    collectionHandles: ["roasted-makhana"],
    metafields: {},
    preview,
  };
}

const cart: ShopifyCart = {
  id: "gid://shopify/Cart/live-id",
  checkoutUrl: "",
  totalQuantity: 2,
  cost: {
    subtotalAmount: { amount: "834.00", currencyCode: "INR" },
    totalAmount: { amount: "834.00", currencyCode: "INR" },
  },
  lines: [{
    id: "line-1",
    quantity: 2,
    merchandise: {
      id: "gid://shopify/ProductVariant/801234567",
      title: "30 g pouch",
      availableForSale: true,
      price: { amount: "417.00", currencyCode: "INR" },
      selectedOptions: [{ name: "Size", value: "30 g pouch" }],
      product: {
        id: "gid://shopify/Product/121",
        title: "Pudina",
        handle: "pudina",
        productType: "Roasted Makhana",
        featuredImage: { url: "/assets/pudina-pop.jpg", alt: "Pudina snack pack" },
      },
    },
  }],
};

describe("commerce presentation preserves Shopify purchase safeguards", () => {
  it("disables Add and Buy Now for preview products and renders no unsupported claim badges", () => {
    const markup = renderToStaticMarkup(createElement(ProductDetail, {
      product: product(true, true),
      faqs: [],
      reviews: [],
      related: [],
    }));
    const addButton = markup.match(/<button[^>]*>Add to bag<\/button>/)?.[0] ?? "";
    const buyButton = markup.match(/<button[^>]*>Buy now<\/button>/)?.[0] ?? "";

    expect(markup).toContain("artifact-product-layout");
    expect(addButton).toContain("disabled");
    expect(buyButton).toContain("disabled");
    expect(markup).not.toMatch(/gluten[ -]?free|high[ -]?protein|jain-friendly|healthy/i);
  });

  it("does not offer card purchase buttons for preview or unavailable products", () => {
    const markup = renderToStaticMarkup(createElement(ProductGrid, {
      products: [product(true, true), product(false, false)],
      filters: true,
    }));

    expect(markup).toContain("Setup preview");
    expect(markup).toContain("Coming soon");
    expect(markup).not.toContain("card-add-button");
    expect(markup).not.toContain("Add to bag +");
  });

  it("renders an honest empty bag state", () => {
    const markup = renderToStaticMarkup(createElement(CartPanel, { initialCart: null, shippingConfigured: false }));

    expect(markup).toContain("artifact-cart-empty");
    expect(markup).toContain("Your bag is empty");
    expect(markup).not.toMatch(/₹\s?299|₹\s?149|₹\s?499/);
  });

  it("renders live cart totals and a populated bag state without sample shipping promises", () => {
    const markup = renderToStaticMarkup(createElement(CartPanel, { initialCart: cart, shippingConfigured: false }));

    expect(markup).toContain("artifact-cart-filled");
    expect(markup).toContain("Pudina");
    expect(markup).toContain("834");
    expect(markup).not.toMatch(/free delivery|free shipping|₹\s?499/);
  });
});
