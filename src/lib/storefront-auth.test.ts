import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { storefrontQuery } from "./storefront";

const environment = ["SHOPIFY_STOREFRONT_PRIVATE_TOKEN", "SHOPIFY_STOREFRONT_PUBLIC_TOKEN", "SHOPIFY_STORE_DOMAIN", "SHOPIFY_API_VERSION"] as const;
const saved = new Map(environment.map((name) => [name, process.env[name]]));

beforeEach(() => {
  process.env.SHOPIFY_STORE_DOMAIN = "projectbeej-1686bmnd.myshopify.com";
  process.env.SHOPIFY_API_VERSION = "2026-10";
  delete process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
  delete process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
});

afterEach(() => {
  for (const name of environment) {
    const value = saved.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Storefront API credentials", () => {
  it("rejects an Admin API credential in the Storefront private-token setting", async () => {
    process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = "shpat_test-only";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(storefrontQuery("query { shop { name } }")).rejects.toThrow("Admin API token cannot be used as a Storefront API private token.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the private token server-side and forwards a valid buyer IP", async () => {
    process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN = "shpss_test-only";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toContain("/api/2026-10/graphql.json");
      expect(init?.method).toBe("POST");
      return { ok: true, json: async () => ({ data: { shop: { name: "Project Beej" } } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await storefrontQuery("query { shop { name } }", {}, "192.0.2.8, 10.0.0.2");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = request.headers as Record<string, string>;
    expect(headers["Shopify-Storefront-Private-Token"]).toBe("shpss_test-only");
    expect(headers["Shopify-Storefront-Buyer-IP"]).toBe("192.0.2.8");
    expect(headers["Shopify-Storefront-Access-Token"]).toBeUndefined();
  });
});
