import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/components/cart-coordinator", () => ({
  cartCoordinator: { adjustQuantity: vi.fn(), setQuantity: vi.fn(), flush: vi.fn(), getSnapshot: vi.fn() },
  describeProductVariant: vi.fn(() => ({})),
  useCartSnapshot: vi.fn(() => ({ cart: null, confirmedCart: null, loaded: true, loading: false, pending: false, message: "" })),
}));
vi.mock("@/lib/storefront", () => ({ getCardProducts: vi.fn() }));

import { RelatedProducts } from "./RelatedProducts";
import { getCardProducts } from "@/lib/storefront";

const products: BeejProduct[] = [{
  id: "gid://shopify/Product/cheese",
  handle: "cheese",
  title: "Cheese",
  description: "A Shopify-managed product description.",
  productType: "Roasted Makhana",
  images: [
    { url: "/assets/cheese-jar.jpg", alt: "Cheese jar" },
    { url: "/assets/cheese-table.jpg", alt: "Cheese snack scene" },
  ],
  variants: [{ id: "gid://shopify/ProductVariant/cheese", title: "Jar", availableForSale: true, price: { amount: "299", currencyCode: "INR" }, selectedOptions: [] }],
  price: { amount: "299", currencyCode: "INR" },
  availableForSale: true,
  collectionHandles: ["roasted-makhana"],
  metafields: {},
  preview: false,
}];

describe("related product presentation", () => {
  beforeEach(() => {
    vi.mocked(getCardProducts).mockResolvedValue(products);
  });

  it("uses the same image-led product cards as the shop and home shelves", async () => {
    const section = await RelatedProducts({ currentProductId: "gid://shopify/Product/current" });
    const markup = renderToStaticMarkup(createElement(() => section));

    expect(markup).toContain("artifact-shop-grid");
    expect(markup).toContain("shop-product-card");
    expect(markup).toContain('data-hover-image-src="/assets/cheese-table.jpg"');
    expect(markup).toContain(">ADD</button>");
    expect(markup).not.toContain("product-mascot");
    expect(markup).not.toContain("Add to bag +");
  });
});
