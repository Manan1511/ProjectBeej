import { describe, expect, it } from "vitest";
import { canEmitCommerceEvent, makeVariantTrackingId, sanitizeTelemetryLocation } from "@/lib/tracking-events";

describe("commerce tracking rules", () => {
  it("keeps purchase reporting out of browser events", () => {
    expect(canEmitCommerceEvent({ name: "page_view", page_location: "https://beej.example/" }, { analytics: true, marketing: false, preferences: false })).toBe(true);
    expect(canEmitCommerceEvent({ name: "page_view", page_location: "https://beej.example/" }, { analytics: false, marketing: true, preferences: false })).toBe(false);
    expect(canEmitCommerceEvent({ name: "add_to_cart", currency: "INR", value: 299, items: [] }, { analytics: false, marketing: true, preferences: false })).toBe(true);
  });

  it("uses the same numeric Shopify variant identifier in storefront events", () => {
    expect(makeVariantTrackingId("gid://shopify/ProductVariant/123456789")).toBe("beej_123456789");
    expect(makeVariantTrackingId("preview:pudina")).toBeNull();
    expect(makeVariantTrackingId("untrusted123")).toBeNull();
  });

  it("keeps telemetry locations to the site path and approved UTMs", () => {
    expect(sanitizeTelemetryLocation(
      "https://beej.example/products/pudina?utm_source=instagram&utm_campaign=diwali&email=hello%40example.com&checkout=private#reviews",
      "https://beej.example",
    )).toBe("https://beej.example/products/pudina?utm_source=instagram&utm_campaign=diwali");
    expect(sanitizeTelemetryLocation("https://evil.example/checkout?key=secret", "https://beej.example")).toBe("");
  });
});
