import { describe, expect, it } from "vitest";
import type { BeejProduct } from "./types";
import { searchProducts } from "./product-search";

function product(overrides: Pick<BeejProduct, "handle" | "title" | "productType" | "description">): BeejProduct {
  return {
    id: overrides.handle,
    images: [],
    variants: [],
    price: { amount: "299", currencyCode: "INR" },
    availableForSale: true,
    collectionHandles: [],
    metafields: {},
    preview: false,
    ...overrides,
  };
}

const products = [
  product({ handle: "pudina", title: "Pudina", productType: "Roasted Makhana", description: "Cool mint with a sharp finish." }),
  product({ handle: "classic-makhana", title: "Classic Makhana", productType: "Ready to Roast", description: "Roast it your way at home." }),
];

describe("shop product search", () => {
  it("matches title, product type, and description without case sensitivity", () => {
    expect(searchProducts(products, "  PUDINA ")).toEqual([products[0]]);
    expect(searchProducts(products, "ready to roast")).toEqual([products[1]]);
    expect(searchProducts(products, "YOUR WAY AT HOME")).toEqual([products[1]]);
  });

  it("returns the full catalog for a blank query", () => {
    expect(searchProducts(products, "   ")).toEqual(products);
  });
});
