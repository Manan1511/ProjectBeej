import { handleAdminContentRequest } from "@/lib/admin-content-handler";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { createShopifyAdminContentStore } from "@/lib/admin-content-shopify";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleAdminContentRequest(request, "read", { isAuthenticated: isAdminRequestAuthenticated, getStore: createShopifyAdminContentStore, now: () => new Date().toISOString() });
}

export async function PUT(request: Request) {
  return handleAdminContentRequest(request, "save", { isAuthenticated: isAdminRequestAuthenticated, getStore: createShopifyAdminContentStore, now: () => new Date().toISOString() });
}
