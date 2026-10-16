import { describe, expect, it } from "vitest";
import { getShopifyRefundStatus } from "./shopify-tracking-admin";
import { runTrackingRecovery } from "./tracking-dispatch";

describe("Shopify tracking Admin module runtime boundary", () => {
  it("loads outside the Next.js server-only module graph", () => {
    expect(getShopifyRefundStatus).toBeTypeOf("function");
  });

  it("loads the scheduled recovery entrypoint outside the Next.js runtime", () => {
    expect(runTrackingRecovery).toBeTypeOf("function");
  });
});
