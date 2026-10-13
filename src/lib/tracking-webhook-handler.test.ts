import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { handleShopifyTrackingWebhook } from "@/lib/tracking-webhook-handler";

afterEach(() => {
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_ADMIN_CLIENT_SECRET;
  delete process.env.SHOPIFY_TRACKING_WEBHOOK_SECRET;
  delete process.env.TRACKING_SIGNING_SECRET;
});

describe("Shopify webhook configuration", () => {
  it("uses the Admin app client secret when no webhook secret override is set", async () => {
    process.env.SHOPIFY_STORE_DOMAIN = "projectbeej-1686bmnd.myshopify.com";
    process.env.SHOPIFY_ADMIN_CLIENT_SECRET = "test-app-client-secret";
    process.env.TRACKING_SIGNING_SECRET = "t".repeat(32);

    const request = new Request("https://store.example/api/webhooks/shopify/tracking", {
      method: "POST",
      headers: {
        "x-shopify-shop-domain": "projectbeej-1686bmnd.myshopify.com",
        "x-shopify-topic": "orders/paid",
        "x-shopify-webhook-id": "4d7ce9fc-7158-4d30-904d-d32e735e6a10",
        "x-shopify-hmac-sha256": `${"A".repeat(43)}=`,
      },
      body: "{}",
    });

    const response = await handleShopifyTrackingWebhook(request);
    expect(response.status).toBe(401);
  });
});
