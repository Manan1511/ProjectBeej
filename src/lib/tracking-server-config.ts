import type { TrackingProviderConfig } from "@/lib/tracking-conversions";

type Environment = Record<string, string | undefined>;

function siteUrl(value?: string): string {
  try {
    const parsed = new URL(value || "");
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.origin : "";
  } catch { return ""; }
}

export function getTrackingProviderConfig(env: Environment, deployContext?: string): TrackingProviderConfig {
  const mode = env.NEXT_PUBLIC_TRACKING_MODE;
  const allowed = mode === "test" || (mode === "production" && deployContext === "production");
  const test = mode === "test";
  const ga4MeasurementId = allowed ? (test ? env.NEXT_PUBLIC_TEST_GA4_MEASUREMENT_ID : env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) || "" : "";
  const ga4ApiSecret = allowed ? (test ? env.GA4_TEST_API_SECRET : env.GA4_API_SECRET) || "" : "";
  const metaPixelId = allowed ? (test ? env.NEXT_PUBLIC_TEST_META_PIXEL_ID : env.NEXT_PUBLIC_META_PIXEL_ID) || "" : "";
  const metaAccessToken = allowed ? (test ? env.META_TEST_CAPI_ACCESS_TOKEN : env.META_CAPI_ACCESS_TOKEN) || "" : "";
  const metaApiVersion = allowed ? (test ? env.META_TEST_CAPI_VERSION : env.META_CAPI_VERSION) || "" : "";
  return {
    ga4MeasurementId: /^G-[A-Z0-9]+$/i.test(ga4MeasurementId) ? ga4MeasurementId : "",
    ga4ApiSecret: ga4ApiSecret.length >= 12 ? ga4ApiSecret : "",
    metaPixelId: /^\d{5,20}$/.test(metaPixelId) ? metaPixelId : "",
    metaAccessToken: metaAccessToken.length >= 24 ? metaAccessToken : "",
    metaApiVersion: /^v\d{2,3}\.\d+$/.test(metaApiVersion) ? metaApiVersion : "",
    siteUrl: siteUrl(env.NEXT_PUBLIC_SITE_URL || env.SITE_URL),
  };
}
