import type { Metadata, Viewport } from "next";
import "@fontsource/anton/400.css";
import "@fontsource-variable/outfit";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { PreviewNotice } from "@/components/PreviewNotice";
import { getSiteSettings, getStorefrontMode } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

const siteUrl = getPublicSiteUrl();

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  title: { default: "Project Beej: Small seeds. Big feels.", template: "%s | Project Beej" },
  description: "Wholesome snacks made from nature’s humblest ingredients, seasoned like they mean it.",
  applicationName: "Project Beej",
  openGraph: { type: "website", siteName: "Project Beej", title: "Project Beej: Small seeds. Big feels.", description: "Wholesome snacks made from nature’s humblest ingredients, seasoned like they mean it.", ...(siteUrl ? { images: ["/assets/pudina-pop.jpg"] } : {}) },
  twitter: { card: "summary_large_image", title: "Project Beej: Small seeds. Big feels.", description: "Wholesome snacks made from nature’s humblest ingredients, seasoned like they mean it.", ...(siteUrl ? { images: ["/assets/pudina-pop.jpg"] } : {}) },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3A4229" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings(await requestBuyerIp());
  const preview = getStorefrontMode() === "preview";
  return (
    <html lang="en" className="font-outfit">
      <body>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {preview ? <PreviewNotice /> : null}
        <SiteHeader settings={settings} />
        {children}
        <SiteFooter settings={settings} />
      </body>
    </html>
  );
}
