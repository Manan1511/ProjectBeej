import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource-variable/outfit";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PreviewNotice } from "@/components/PreviewNotice";
import { getSiteSettings, getStorefrontMode } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getPublicTrackingConfig } from "@/lib/tracking-config";
import { TrackingProvider } from "@/components/TrackingProvider";
import { WebVitalsReporter } from "@/components/WebVitalsReporter";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: "Project Beej | Good things grow from small seeds.", template: "%s | Project Beej" },
  description: "Meet Project Beej, explore the current snack range, and find a new favourite.",
  ...(siteUrl ? { alternates: { canonical: siteUrl } } : {}),
  robots: process.env.CONTEXT === "production" && process.env.SHOPIFY_MODE !== "preview" ? { index: true, follow: true } : { index: false, follow: false },
  applicationName: "Project Beej",
  openGraph: { type: "website", siteName: "Project Beej", title: "Project Beej | Good things grow from small seeds.", description: "Meet Project Beej, explore the current snack range, and find a new favourite.", ...(siteUrl ? { images: ["/assets/pudina-pop.jpg"] } : {}) },
  twitter: { card: "summary_large_image", title: "Project Beej | Good things grow from small seeds.", description: "Meet Project Beej, explore the current snack range, and find a new favourite.", ...(siteUrl ? { images: ["/assets/pudina-pop.jpg"] } : {}) },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3A4229" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings(await requestBuyerIp());
  const preview = getStorefrontMode() === "preview";
  const trackingConfig = getPublicTrackingConfig(process.env, process.env.CONTEXT);
  return (
    <html lang="en" className="font-outfit">
      <body>
        <TrackingProvider config={trackingConfig} shopId={settings.shopId || ""} currency={settings.currencyCode || "INR"}>
          <WebVitalsReporter />
          <a className="skip-link" href="#main-content">Skip to content</a>
          {preview ? <PreviewNotice /> : null}
          <SiteHeader settings={settings} />
          {children}
          <SiteFooter settings={settings} />
        </TrackingProvider>
      </body>
    </html>
  );
}
