import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createConsentCapability,
  createTrackingContextCookie,
  isConsentReduction,
  verifyTrackingContextCookie,
  verifyConsentCapability,
  verifyShopifyWebhookHmac,
} from "@/lib/tracking-security";

const secret = "test-secret-with-enough-entropy-for-unit-tests";
const contextId = "4f70e67a-9e83-4d57-bf18-12096e1c7565";

describe("tracking signatures and consent capability", () => {
  it("accepts only a valid Shopify HMAC over the exact raw body", async () => {
    const raw = "{\"id\":123,\"financial_status\":\"paid\"}";
    const signature = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      .then(async (key) => Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw))).toString("base64"));

    expect(verifyShopifyWebhookHmac(raw, signature, secret)).toBe(true);
    expect(verifyShopifyWebhookHmac(`${raw} `, signature, secret)).toBe(false);
    expect(verifyShopifyWebhookHmac(raw, "invalid", secret)).toBe(false);
  });

  it("issues a signed capability that expires and cannot be forged", () => {
    const now = 1_800_000_000_000;
    const token = createConsentCapability(contextId, secret, now, 60_000);
    expect(verifyConsentCapability(token, secret, now + 30_000)).toBe(contextId);
    expect(verifyConsentCapability(token, secret, now + 61_000)).toBeNull();
    expect(verifyConsentCapability(`${token}x`, secret, now)).toBeNull();
  });

  it("binds the signed context cookie to visitor and context IDs", () => {
    const visitorId = "8dfd33d4-7f8a-48f9-85fd-e795cd15d845";
    const now = 1_800_000_000_000;
    const token = createTrackingContextCookie(visitorId, contextId, secret, now, 60_000);
    expect(verifyTrackingContextCookie(token, secret, now + 30_000)).toEqual({ visitorId, contextId });
    expect(verifyTrackingContextCookie(token, "wrong-secret", now)).toBeNull();
    expect(verifyTrackingContextCookie(token, secret, now + 61_000)).toBeNull();
  });

  it("allows checkout to reduce consent only", () => {
    expect(isConsentReduction(
      { analytics: true, marketing: true, preferences: true },
      { analytics: false, marketing: true, preferences: false },
    )).toBe(true);
    expect(isConsentReduction(
      { analytics: false, marketing: true, preferences: false },
      { analytics: true, marketing: false, preferences: false },
    )).toBe(false);
    expect(isConsentReduction(
      { analytics: true, marketing: false, preferences: false },
      { analytics: false, marketing: false, preferences: false },
    )).toBe(true);
  });
});
