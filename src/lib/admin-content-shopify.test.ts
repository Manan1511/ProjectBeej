import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/shopify-admin-auth", () => ({
  getShopifyAdminAccessToken: vi.fn(async () => "test-admin-token"),
  getShopifyAdminStoreDomain: vi.fn(() => "projectbeej-1686bmnd.myshopify.com"),
}));

import { createShopifyAdminContentStore } from "./admin-content-shopify";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Shopify Admin content adapter", () => {
  it("reads the Shop settings and private AppInstallation draft with compare digests", async () => {
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-10");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      shop: { id: "gid://shopify/Shop/1", storefrontSettings: { value: "{}", compareDigest: "shop-digest" } },
      currentAppInstallation: { id: "gid://shopify/AppInstallation/2", storefrontDraft: { value: "{}", compareDigest: "draft-digest" } },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await createShopifyAdminContentStore().read();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const request = JSON.parse(String(init.body)) as { query: string };

    expect(snapshot).toMatchObject({
      shopId: "gid://shopify/Shop/1",
      appInstallationId: "gid://shopify/AppInstallation/2",
      published: { compareDigest: "shop-digest" },
      draft: { compareDigest: "draft-digest" },
    });
    expect(url).toBe("https://projectbeej-1686bmnd.myshopify.com/admin/api/2026-10/graphql.json");
    expect(new Headers(init.headers).get("x-shopify-access-token")).toBe("test-admin-token");
    expect(request.query).toContain("currentAppInstallation");
    expect(request.query).toContain("compareDigest");
    expect(init.cache).toBe("no-store");
  });

  it("writes Shop and app data metafields with atomic compare-and-swap inputs", async () => {
    vi.stubEnv("SHOPIFY_API_VERSION", "2026-10");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      metafieldsSet: { metafields: [{ key: "storefront_settings" }, { key: "storefront_content_draft" }], userErrors: [] },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const writes = [
      { ownerId: "gid://shopify/Shop/1", namespace: "beej", key: "storefront_settings", type: "json", value: "{}", compareDigest: null },
      { ownerId: "gid://shopify/AppInstallation/2", key: "storefront_content_draft", type: "json", value: "{}", compareDigest: "draft-digest" },
    ] as const;

    await createShopifyAdminContentStore().setMetafields([...writes]);
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { query: string; variables: { metafields: Array<Record<string, unknown>> } };

    expect(request.query).toContain("metafieldsSet(metafields: $metafields)");
    expect(request.variables.metafields).toEqual([
      { ownerId: "gid://shopify/Shop/1", namespace: "beej", key: "storefront_settings", type: "json", value: "{}", compareDigest: null },
      { ownerId: "gid://shopify/AppInstallation/2", key: "storefront_content_draft", type: "json", value: "{}", compareDigest: "draft-digest" },
    ]);
  });

  it("returns a conflict when Shopify rejects a stale compare digest", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      metafieldsSet: { metafields: [], userErrors: [{ field: ["metafields", "0", "compareDigest"], message: "Compare digest mismatch", code: "STALE_OBJECT" }] },
    } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createShopifyAdminContentStore().setMetafields([
      { ownerId: "gid://shopify/Shop/1", namespace: "beej", key: "storefront_settings", type: "json", value: "{}", compareDigest: "stale" },
    ])).rejects.toMatchObject({ code: "conflict" });
  });

  it("does not expose Shopify API errors or credentials", async () => {
    vi.stubEnv("SHOPIFY_ADMIN_CLIENT_SECRET", "very-private-value");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: "sensitive internal detail" }] }), { status: 200 })));

    await expect(createShopifyAdminContentStore().read()).rejects.toMatchObject({ code: "unavailable" });
    await expect(createShopifyAdminContentStore().read()).rejects.not.toThrow("very-private-value");
  });
});
