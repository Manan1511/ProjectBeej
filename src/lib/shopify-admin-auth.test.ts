import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "./shopify-admin-auth";

afterEach(() => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_ADMIN_CLIENT_ID;
  delete process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function configureCredentials(clientId = "auth-test-client") {
  process.env.SHOPIFY_STORE_DOMAIN = "projectbeej-1686bmnd.myshopify.com";
  process.env.SHOPIFY_ADMIN_CLIENT_ID = clientId;
  process.env.SHOPIFY_ADMIN_CLIENT_SECRET = `${clientId}-secret`;
}

function tokenResponse(token: string, expiresIn = 86_399) {
  return new Response(JSON.stringify({ access_token: token, expires_in: expiresIn }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("Shopify Admin client-credentials authentication", () => {
  it("exchanges the app credentials and caches the issued token", async () => {
    configureCredentials();
    const fetchMock = vi.fn().mockResolvedValue(tokenResponse("issued-admin-token"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShopifyAdminAccessToken()).resolves.toBe("issued-admin-token");
    await expect(getShopifyAdminAccessToken()).resolves.toBe("issued-admin-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://projectbeej-1686bmnd.myshopify.com/admin/oauth/access_token");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.headers).toMatchObject({ "Content-Type": "application/x-www-form-urlencoded" });
    expect(String(init.body)).toContain("grant_type=client_credentials");
    expect(String(init.body)).toContain("client_id=auth-test-client");
    expect(String(init.body)).toContain("client_secret=auth-test-client-secret");
    expect(getShopifyAdminStoreDomain()).toBe("projectbeej-1686bmnd.myshopify.com");
  });

  it("shares one token exchange across concurrent Admin requests", async () => {
    configureCredentials("concurrent-client");
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);

    const first = getShopifyAdminAccessToken();
    const second = getShopifyAdminAccessToken();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(tokenResponse("shared-admin-token"));

    await expect(Promise.all([first, second])).resolves.toEqual(["shared-admin-token", "shared-admin-token"]);
  });

  it("refreshes before the cached token expires", async () => {
    configureCredentials("expiry-client");
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(tokenResponse("first-admin-token", 120))
      .mockResolvedValueOnce(tokenResponse("refreshed-admin-token", 120));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShopifyAdminAccessToken()).resolves.toBe("first-admin-token");
    now.mockReturnValue(1_109_000);
    await expect(getShopifyAdminAccessToken()).resolves.toBe("refreshed-admin-token");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails closed when credentials are missing or the store domain is invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShopifyAdminAccessToken()).rejects.toThrow("Shopify Admin app credentials are not configured.");
    configureCredentials("invalid-domain-client");
    process.env.SHOPIFY_STORE_DOMAIN = "attacker.example";
    await expect(getShopifyAdminAccessToken()).rejects.toThrow("Shopify Admin store domain is invalid.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsuccessful or malformed token responses without exposing credentials", async () => {
    configureCredentials("bad-response-client");
    const fetchMock = vi.fn().mockResolvedValue(new Response("not-json", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getShopifyAdminAccessToken()).rejects.toThrow("Shopify Admin access token could not be obtained.");
  });
});
