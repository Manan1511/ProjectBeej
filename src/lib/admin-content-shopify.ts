import "server-only";
import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";
import { AdminContentStoreError, type AdminContentStore, type AdminContentStoreSnapshot, type AdminMetafieldWrite } from "@/lib/admin-content-store";

type ShopifyError = { message?: string; code?: string | null; field?: string[] | null };
type ShopifyResponse<T> = { data?: T; errors?: ShopifyError[] };

const READ_CONTENT_QUERY = `query BeejAdminContent {
  shop {
    id
    storefrontSettings: metafield(namespace: "beej", key: "storefront_settings") { value compareDigest }
  }
  currentAppInstallation {
    id
    storefrontDraft: metafield(key: "storefront_content_draft") { value compareDigest }
  }
}`;

const SET_METAFIELDS_MUTATION = `mutation BeejSetAdminContent($metafields: [MetafieldsSetInput!]!) {
  metafieldsSet(metafields: $metafields) {
    metafields { id namespace key value compareDigest }
    userErrors { field message code }
  }
}`;

function apiVersion(): string {
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) throw new AdminContentStoreError("unavailable", "Shopify Admin API version is invalid.");
  return version;
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const domain = getShopifyAdminStoreDomain();
  const token = await getShopifyAdminAccessToken();
  let response: Response;
  try {
    response = await fetch(`https://${domain}/admin/api/${apiVersion()}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new Error("Shopify Admin request did not return a response.");
  }
  if (!response.ok) throw new AdminContentStoreError("unavailable", "Shopify Admin is temporarily unavailable.");
  let payload: ShopifyResponse<T>;
  try {
    payload = await response.json() as ShopifyResponse<T>;
  } catch {
    throw new AdminContentStoreError("unavailable", "Shopify Admin returned an invalid response.");
  }
  if (payload.errors?.length || !payload.data) throw new AdminContentStoreError("unavailable", "Shopify Admin could not process the content request.");
  return payload.data;
}

function toMetafield(value: { value?: string | null; compareDigest?: string | null } | null | undefined) {
  if (!value) return null;
  if (typeof value.value !== "string" || typeof value.compareDigest !== "string") {
    throw new AdminContentStoreError("unavailable", "Shopify returned an incomplete storefront content metafield.");
  }
  return { value: value.value, compareDigest: value.compareDigest };
}

export function createShopifyAdminContentStore(): AdminContentStore {
  return {
    async read(): Promise<AdminContentStoreSnapshot> {
      const data = await adminGraphql<{
        shop?: { id?: string; storefrontSettings?: { value?: string | null; compareDigest?: string | null } | null } | null;
        currentAppInstallation?: { id?: string; storefrontDraft?: { value?: string | null; compareDigest?: string | null } | null } | null;
      }>(READ_CONTENT_QUERY);
      if (!data.shop?.id || !data.currentAppInstallation?.id) {
        throw new AdminContentStoreError("unavailable", "Shopify did not return the content owner records.");
      }
      return {
        shopId: data.shop.id,
        appInstallationId: data.currentAppInstallation.id,
        published: toMetafield(data.shop.storefrontSettings),
        draft: toMetafield(data.currentAppInstallation.storefrontDraft),
      };
    },

    async setMetafields(writes: AdminMetafieldWrite[]): Promise<void> {
      if (!writes.length || writes.length > 25) throw new AdminContentStoreError("invalid", "The Shopify content update is invalid.");
      const data = await adminGraphql<{
        metafieldsSet?: { metafields?: unknown[] | null; userErrors?: ShopifyError[] | null } | null;
      }>(SET_METAFIELDS_MUTATION, { metafields: writes });
      const result = data.metafieldsSet;
      if (!result) throw new AdminContentStoreError("unavailable", "Shopify did not confirm the content update.");
      const errors = result.userErrors ?? [];
      if (errors.length) {
        const conflict = errors.some((error) => `${error.code || ""} ${error.message || ""}`.toLowerCase().includes("compare")
          || `${error.code || ""} ${error.message || ""}`.toLowerCase().includes("stale"));
        if (conflict) throw new AdminContentStoreError("conflict", "Shopify content changed in another session. Reload to review the latest version.");
        throw new AdminContentStoreError("unavailable", "Shopify refused the content update. Check the app's metafield access and try again.");
      }
      if (!Array.isArray(result.metafields) || result.metafields.length !== writes.length) {
        throw new Error("Shopify did not confirm every metafield write.");
      }
    },
  };
}
