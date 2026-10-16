export type TrackingMode = "off" | "test" | "production";
export type PublicTrackingConfig = {
  mode: TrackingMode;
  enabled: boolean;
  gtmId: string;
  ga4MeasurementId: string;
  metaPixelId: string;
  shopDomain: string;
  siteUrl: string;
};

type Environment = Record<string, string | undefined>;

function safeSiteUrl(value: string | undefined): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : "";
  } catch {
    return "";
  }
}

function safeShopDomain(value: string | undefined): string {
  return value && /^[-a-z0-9]+\.myshopify\.com$/i.test(value) ? value : "projectbeej-1686bmnd.myshopify.com";
}

export function getPublicTrackingConfig(env: Environment, deployContext?: string): PublicTrackingConfig {
  const requestedMode = env.NEXT_PUBLIC_TRACKING_MODE;
  const mode: TrackingMode = requestedMode === "test" || requestedMode === "production" ? requestedMode : "off";
  const effectiveDeployContext = deployContext ?? env.TRACKING_DEPLOY_CONTEXT ?? env.CONTEXT;
  const permitted = mode === "test" || (mode === "production" && effectiveDeployContext === "production");
  const testMode = mode === "test";
  const candidateGtm = permitted ? (testMode ? env.NEXT_PUBLIC_TEST_GTM_ID : env.NEXT_PUBLIC_GTM_ID) : undefined;
  const candidateGa4 = permitted ? (testMode ? env.NEXT_PUBLIC_TEST_GA4_MEASUREMENT_ID : env.NEXT_PUBLIC_GA4_MEASUREMENT_ID) : undefined;
  const candidateMeta = permitted ? (testMode ? env.NEXT_PUBLIC_TEST_META_PIXEL_ID : env.NEXT_PUBLIC_META_PIXEL_ID) : undefined;
  return {
    mode,
    enabled: permitted,
    gtmId: candidateGtm && /^GTM-[A-Z0-9]+$/i.test(candidateGtm) ? candidateGtm : "",
    ga4MeasurementId: candidateGa4 && /^G-[A-Z0-9]+$/i.test(candidateGa4) ? candidateGa4 : "",
    metaPixelId: candidateMeta && /^\d{5,20}$/.test(candidateMeta) ? candidateMeta : "",
    shopDomain: safeShopDomain(env.SHOPIFY_STORE_DOMAIN),
    siteUrl: safeSiteUrl(env.NEXT_PUBLIC_SITE_URL || env.SITE_URL),
  };
}
