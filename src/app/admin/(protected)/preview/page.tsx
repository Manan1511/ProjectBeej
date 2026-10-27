import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPreviewControls } from "@/components/admin/AdminPreviewControls";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomePageContent } from "@/app/(storefront)/page";
import { ShopPageContent } from "@/app/(storefront)/shop/page";
import { AboutPageContent } from "@/app/(storefront)/about/page";
import { getRequestCachedSiteSettings } from "@/lib/storefront";
import { createShopifyAdminContentStore } from "@/lib/admin-content-shopify";
import { getAdminContentState } from "@/lib/admin-content-store";
import { mergeAdminContent } from "@/lib/admin-content";
import type { SiteSettings } from "@/lib/types";

export const metadata: Metadata = { title: "Draft preview", robots: { index: false, follow: false, noarchive: true } };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function AdminPreviewPage({ searchParams }: Props) {
  const [{ page = "home" }, [published, state]] = await Promise.all([
    searchParams,
    Promise.all([getRequestCachedSiteSettings(), getAdminContentState(createShopifyAdminContentStore())]),
  ]);
  if (page !== "home" && page !== "shop" && page !== "about") notFound();
  const settings = mergeAdminContent(published as Record<string, unknown>, state.draft) as SiteSettings;
  const pageContent = page === "home"
    ? await HomePageContent({ settingsOverride: settings, previewMode: true })
    : page === "shop"
      ? await ShopPageContent({ searchParams: Promise.resolve({}), settingsOverride: settings, previewMode: true })
      : await AboutPageContent({ settingsOverride: settings });
  const label = page === "about" ? "Our Story" : page === "home" ? "Home" : "Shop";

  return <AdminPreviewControls section={label} hasConflict={state.conflict}>
    <SiteHeader settings={settings} preview />
    {pageContent}
    <SiteFooter settings={settings} preview />
  </AdminPreviewControls>;
}
