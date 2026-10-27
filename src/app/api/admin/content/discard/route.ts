import { handleAdminContentRequest } from "@/lib/admin-content-handler";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { createShopifyAdminContentStore } from "@/lib/admin-content-shopify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAdminContentRequest(request, "discard", { isAuthenticated: isAdminRequestAuthenticated, getStore: createShopifyAdminContentStore, now: () => new Date().toISOString() });
}
