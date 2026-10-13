import type { NetlifyFunction } from "@netlify/functions";
import { handleShopifyTrackingWebhook } from "../../src/lib/tracking-webhook-handler.js";
import { runTrackingOutbox } from "../../src/lib/tracking-dispatch.js";

const shopifyTrackingWebhook: NetlifyFunction = {
  config: { path: "/api/webhooks/shopify/tracking" },
  async fetch(request, context) {
    const response = await handleShopifyTrackingWebhook(request);
    if (response.ok) context.waitUntil(runTrackingOutbox().catch(() => undefined));
    return response;
  },
};

export default shopifyTrackingWebhook;
