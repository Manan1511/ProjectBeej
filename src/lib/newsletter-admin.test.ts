import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { subscribeWithConsent } from "./newsletter";

afterEach(() => {
  delete process.env.SHOPIFY_ADMIN_CLIENT_ID;
  delete process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Shopify newsletter consent write", () => {
  it("uses the shared Admin app credentials to upsert the email and record explicit opt-in", async () => {
    process.env.SHOPIFY_ADMIN_CLIENT_ID = "test-client-id";
    process.env.SHOPIFY_ADMIN_CLIENT_SECRET = "test-client-secret";
    let calls = 0;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      if (calls === 1) {
        expect(String(_url)).toBe("https://projectbeej-1686bmnd.myshopify.com/admin/oauth/access_token");
        expect(String(init?.body)).toContain("grant_type=client_credentials");
        expect(String(init?.body)).toContain("client_id=test-client-id");
        expect(String(init?.body)).toContain("client_secret=test-client-secret");
        return { ok: true, json: async () => ({ access_token: "issued-admin-token", expires_in: 86399 }) } as Response;
      }
      const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Shopify-Access-Token"]).toBe("issued-admin-token");
      if (calls === 2) {
        expect(body.query).toContain("customerSet");
        expect(body.variables.identifier).toEqual({ email: "seed@example.com" });
        return { ok: true, json: async () => ({ data: { customerSet: { customer: { id: "gid://shopify/Customer/1" }, userErrors: [] } } }) } as Response;
      }
      expect(body.query).toContain("customerEmailMarketingConsentUpdate");
      expect(body.variables).toMatchObject({ input: { customerId: "gid://shopify/Customer/1", emailMarketingConsent: { marketingState: "SUBSCRIBED", marketingOptInLevel: "SINGLE_OPT_IN" } } });
      return { ok: true, json: async () => ({ data: { customerEmailMarketingConsentUpdate: { customer: { id: "gid://shopify/Customer/1" }, userErrors: [] } } }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(subscribeWithConsent("seed@example.com")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not claim a successful subscription without shared Admin app credentials", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.SHOPIFY_ADMIN_CLIENT_ID;
    delete process.env.SHOPIFY_ADMIN_CLIENT_SECRET;

    await expect(subscribeWithConsent("seed@example.com")).rejects.toThrow("Shopify Admin app credentials are not configured.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
