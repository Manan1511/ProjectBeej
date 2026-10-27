import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getPublicSiteUrl } from "@/lib/site-url";

const outfit = localFont({
  src: "../../node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
  preload: true,
});
const anton = localFont({
  src: "../../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2",
  variable: "--font-anton",
  weight: "400",
  display: "swap",
  preload: false,
});
const dmSerifDisplay = localFont({
  src: "../../node_modules/@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2",
  variable: "--font-dm-serif-display",
  weight: "400",
  display: "swap",
  preload: true,
});

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${anton.variable} ${dmSerifDisplay.variable}`}>
      <body>{children}</body>
    </html>
  );
}
