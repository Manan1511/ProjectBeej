import { describe, expect, it } from "vitest";
import { buildCheckoutTrackingAttributes } from "@/lib/tracking-cart-attributes";
import type { StoredCheckoutContext } from "@/lib/tracking-store";

const context: StoredCheckoutContext = {
  context_id: "ctx",
  visitor_id: "visitor",
  consent: { analytics: true, marketing: false, preferences: false },
  attribution: {
    firstTouch: { utm_source: "search", landingPath: "/", capturedAt: "2026-10-13T10:00:00.000Z" },
    lastTouch: { utm_source: "newsletter", landingPath: "/shop", capturedAt: "2026-10-13T10:00:00.000Z" },
  },
  identifiers: { clientId: "123.456", sessionId: "456", gclid: "should-not-leak", fbp: "fb.1.2" },
  client_ip: null,
  user_agent: null,
};

describe("checkout tracking cart attributes", () => {
  it("includes only consented IDs and allowlisted campaign context", () => {
    const attributes = buildCheckoutTrackingAttributes(context, "signed-capability");
    expect(attributes).toContainEqual({ key: "beej_tracking_context", value: "signed-capability" });
    expect(attributes).toContainEqual({ key: "beej_ga_client_id", value: "123.456" });
    expect(attributes).toContainEqual({ key: "beej_last_utm_source", value: "newsletter" });
    expect(attributes.some(({ value }) => value.includes("should-not-leak") || value.includes("fb.1.2"))).toBe(false);
  });

  it("keeps only the consent capability when tracking consent is denied", () => {
    const denied = { ...context, consent: { analytics: false, marketing: false, preferences: false } };
    expect(buildCheckoutTrackingAttributes(denied, "signed-capability")).toEqual([
      { key: "beej_tracking_context", value: "signed-capability" },
    ]);
  });
});
