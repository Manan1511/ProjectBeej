import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { subscribeWithConsent } from "./newsletter";

afterEach(() => {
  delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Shopify newsletter consent write", () => {
  it("upserts the email, then records the explicit opt-in through Shopify", async () => {
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = "shpat_test-only";
    let calls = 0;
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      const body = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      const headers = init?.headers as Record<string, string>;
      expect(headers["X-Shopify-Access-Token"]).toBe("shpat_test-only");
      if (calls === 1) {
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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not claim a successful subscription without an Admin token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    await expect(subscribeWithConsent("seed@example.com")).rejects.toThrow("Newsletter sign-up is not configured yet.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
