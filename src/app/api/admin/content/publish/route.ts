import { revalidatePath, revalidateTag } from "next/cache";
import { handleAdminContentRequest } from "@/lib/admin-content-handler";
import { isAdminRequestAuthenticated } from "@/lib/admin-auth";
import { createShopifyAdminContentStore } from "@/lib/admin-content-shopify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = await handleAdminContentRequest(request, "publish", { isAuthenticated: isAdminRequestAuthenticated, getStore: createShopifyAdminContentStore, now: () => new Date().toISOString() });
  if (response.ok) {
    revalidateTag("storefront-settings", { expire: 0 });
    revalidatePath("/", "layout");
    revalidatePath("/shop");
    revalidatePath("/about");
  }
  return response;
}
