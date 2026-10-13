import { describe, expect, it } from "vitest";
import { buildGoogleMerchantFeed, buildMetaCatalogFeed, isValidGtin } from "@/lib/product-feeds";
import type { BeejProduct } from "@/lib/types";

const product: BeejProduct = {
  id: "gid://shopify/Product/10",
  handle: "peri-peri",
  title: "Peri & Peri",
  description: "Bright, bold crunch.",
  vendor: "Project Beej",
  seo: { title: "Peri Peri Makhana", description: "A bright & bold snack." },
  productType: "Roasted Makhana",
  images: [{ url: "https://cdn.shopify.com/peri.jpg", alt: "Peri pack" }, { url: "https://cdn.shopify.com/lifestyle.jpg", alt: "Bowl" }],
  variants: [
    { id: "gid://shopify/ProductVariant/123", title: "30 g", sku: "BEEJ-PERI-30", barcode: "4006381333931", compareAtPrice: { amount: "349.00", currencyCode: "INR" }, availableForSale: true, price: { amount: "299.00", currencyCode: "INR" }, selectedOptions: [] },
    { id: "gid://shopify/ProductVariant/124", title: "60 g", availableForSale: false, price: { amount: "499.00", currencyCode: "INR" }, selectedOptions: [] },
  ],
  price: { amount: "299.00", currencyCode: "INR" },
  availableForSale: true,
  collectionHandles: ["roasted-makhana"],
  metafields: { faqs: "", approvedReviews: "" },
  preview: false,
};

describe("product feed data", () => {
  it("uses Beej variant IDs, correct deep links, Shopify prices and current stock", () => {
    const feed = buildGoogleMerchantFeed([product], "https://beej.example");
    expect(feed).toContain("<g:id>beej_123</g:id>");
    expect(feed).toContain("https://beej.example/products/peri-peri?variant=123");
    expect(feed).toMatch(/<g:price>INR 349\.00<\/g:price>\s*<g:sale_price>INR 299\.00<\/g:sale_price>/);
    expect(feed).toContain("<g:availability>in_stock</g:availability>");
    expect(feed).toContain("<g:id>beej_124</g:id>");
    expect(feed).toContain("<g:availability>out_of_stock</g:availability>");
    expect(feed).toContain("<g:gtin>4006381333931</g:gtin>");
    expect(feed).toContain("&amp;");
  });

  it("omits drafts and never invents identifiers", () => {
    const feed = buildGoogleMerchantFeed([{ ...product, preview: true }], "https://beej.example");
    expect(feed).not.toContain("beej_123");
    const missingIdentifiers = buildGoogleMerchantFeed([{ ...product, variants: [{ ...product.variants[0]!, sku: null, barcode: "bad" }] }], "https://beej.example");
    expect(missingIdentifiers).toContain("<g:identifier_exists>false</g:identifier_exists>");
    expect(missingIdentifiers).not.toContain("<g:gtin>");
  });

  it("produces a catalogue-compatible CSV with shared item IDs", () => {
    const csv = buildMetaCatalogFeed([product], "https://beej.example");
    expect(csv).toContain('id,title,description,availability,condition,price,link,image_link,brand,mpn,gtin,product_type');
    expect(csv).toContain('beej_123,"Peri & Peri - 30 g"');
    expect(csv).toContain("INR 299.00");
    expect(csv).toContain("4006381333931");
  });

  it("validates GTIN checksums instead of trusting any digit string", () => {
    expect(isValidGtin("4006381333931")).toBe(true);
    expect(isValidGtin("4006381333932")).toBe(false);
  });
});
