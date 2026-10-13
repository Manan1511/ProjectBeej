import { describe, expect, it } from "vitest";
import { getPublicTrackingConfig } from "@/lib/tracking-config";

describe("public tracking configuration", () => {
  it("defaults to disabled", () => {
    expect(getPublicTrackingConfig({})).toEqual({
      mode: "off",
      enabled: false,
      gtmId: "",
      ga4MeasurementId: "",
      metaPixelId: "",
      shopDomain: "projectbeej-1686bmnd.myshopify.com",
      siteUrl: "",
    });
  });

  it("uses only test destinations in test mode", () => {
    const result = getPublicTrackingConfig({
      NEXT_PUBLIC_TRACKING_MODE: "test",
      NEXT_PUBLIC_TEST_GTM_ID: "GTM-TEST123",
      NEXT_PUBLIC_GTM_ID: "GTM-PROD123",
      NEXT_PUBLIC_TEST_GA4_MEASUREMENT_ID: "G-TEST123",
      NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-PROD123",
      NEXT_PUBLIC_SITE_URL: "https://beej.example",
    });
    expect(result).toMatchObject({ mode: "test", enabled: true, gtmId: "GTM-TEST123", ga4MeasurementId: "G-TEST123" });
  });

  it("keeps production destinations disabled outside production deploy context", () => {
    const env = { NEXT_PUBLIC_TRACKING_MODE: "production", NEXT_PUBLIC_GTM_ID: "GTM-PROD123" };
    expect(getPublicTrackingConfig(env, "deploy-preview").enabled).toBe(false);
    expect(getPublicTrackingConfig(env, "production")).toMatchObject({ enabled: true, gtmId: "GTM-PROD123" });
  });
});
