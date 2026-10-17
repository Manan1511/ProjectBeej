import { describe, expect, it } from "vitest";
import { variantIdFromSearch } from "@/lib/product-variant";

describe("product variant URLs", () => {
  const variants = [{ id: "gid://shopify/ProductVariant/801234567" }, { id: "gid://shopify/ProductVariant/123" }];

  it("selects the requested Shopify variant after client hydration", () => {
    expect(variantIdFromSearch(variants, "?variant=801234567")).toBe(variants[0].id);
  });

  it("ignores malformed or unknown variants", () => {
    expect(variantIdFromSearch(variants, "?variant=abc")).toBeUndefined();
    expect(variantIdFromSearch(variants, "?variant=999")).toBeUndefined();
  });
});
