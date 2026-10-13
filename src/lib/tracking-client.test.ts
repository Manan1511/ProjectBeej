import { describe, expect, it, vi } from "vitest";
import { emitCommerceEvent, setTrackingRuntime } from "@/lib/tracking-client";

describe("tracking client runtime handoff", () => {
  it("flushes pre-runtime events once runtime consent is known and blocks denied events", () => {
    const dataLayer: unknown[] = [];
    vi.stubGlobal("window", {
      dataLayer,
      location: { origin: "https://beej.test", href: "https://beej.test/shop" },
    });
    const config = {
      mode: "test" as const,
      enabled: true,
      gtmId: "",
      ga4MeasurementId: "",
      metaPixelId: "",
      shopDomain: "projectbeej-1686bmnd.myshopify.com",
      siteUrl: "https://beej.test",
    };

    emitCommerceEvent({ name: "newsletter_signup", method: "email" });
    setTrackingRuntime({ config, consent: { analytics: true, marketing: false, preferences: false }, shopId: "", currency: "INR" });
    expect(dataLayer.filter((value) => Boolean(value && typeof value === "object" && "event" in value && value.event === "newsletter_signup"))).toHaveLength(1);

    setTrackingRuntime({ config, consent: { analytics: false, marketing: false, preferences: false }, shopId: "", currency: "INR" });
    emitCommerceEvent({ name: "newsletter_signup", method: "email" });
    expect(dataLayer.filter((value) => Boolean(value && typeof value === "object" && "event" in value && value.event === "newsletter_signup"))).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
