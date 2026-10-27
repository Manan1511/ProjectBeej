import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";

export const metadata: Metadata = { title: "Content editor", robots: { index: false, follow: false, noarchive: true } };

export default function AdminHomePage() {
  const shop = getShopifyAdminStoreDomain().replace(/\.myshopify\.com$/i, "");
  return <AdminDashboard shopifyAdminBase={`https://admin.shopify.com/store/${shop}`} />;
}
