import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StorefrontSettingsProvider } from "@/components/StorefrontSettingsProvider";
import { PreviewNotice } from "@/components/PreviewNotice";
import { TrackingProvider } from "@/components/TrackingProvider";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";
import { NavigationTimingReporter } from "@/components/NavigationTimingReporter";
import { getStorefrontMode, getRequestCachedSiteSettings } from "@/lib/storefront";
import { getPublicTrackingConfig } from "@/lib/tracking-config";
import { resolveAdminSiteSettings } from "@/lib/admin-content";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = resolveAdminSiteSettings(await getRequestCachedSiteSettings());
  const preview = getStorefrontMode() === "preview";
  const trackingConfig = getPublicTrackingConfig(process.env, process.env.TRACKING_DEPLOY_CONTEXT || process.env.CONTEXT);
  return (
    <StorefrontSettingsProvider initialSettings={settings}>
      <TrackingProvider config={trackingConfig} shopId={settings.shopId || ""} currency={settings.currencyCode || "INR"}>
        <WebVitalsReporter />
        <NavigationTimingReporter />
        <a className="skip-link" href="#main-content">Skip to content</a>
        {preview ? <PreviewNotice /> : null}
        <SiteHeader settings={settings} />
        {children}
        <SiteFooter settings={settings} />
      </TrackingProvider>
    </StorefrontSettingsProvider>
  );
}
