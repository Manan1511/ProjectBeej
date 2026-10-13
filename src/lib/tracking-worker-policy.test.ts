import { describe, expect, it } from "vitest";
import { nextTrackingRetry, providerConsentAllowed, providerTimestampExpired } from "@/lib/tracking-worker-policy";

describe("tracking worker policy", () => {
  it("requires both order-time and latest consent", () => {
    expect(providerConsentAllowed("ga4", { analytics: true, marketing: true }, { analytics: true, marketing: false })).toBe(true);
    expect(providerConsentAllowed("ga4", { analytics: true, marketing: true }, { analytics: false, marketing: true })).toBe(false);
    expect(providerConsentAllowed("meta", { analytics: true, marketing: true }, { analytics: true, marketing: false })).toBe(false);
    expect(providerConsentAllowed("meta", { analytics: false, marketing: true }, { analytics: false, marketing: true })).toBe(true);
  });

  it("uses bounded retries in the approved sequence", () => {
    const now = new Date("2026-10-13T10:00:00.000Z");
    expect(nextTrackingRetry(1, now)?.toISOString()).toBe("2026-10-13T10:05:00.000Z");
    expect(nextTrackingRetry(2, now)?.toISOString()).toBe("2026-10-13T10:15:00.000Z");
    expect(nextTrackingRetry(3, now)?.toISOString()).toBe("2026-10-13T11:00:00.000Z");
    expect(nextTrackingRetry(4, now)?.toISOString()).toBe("2026-10-13T16:00:00.000Z");
    expect(nextTrackingRetry(5, now)?.toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(nextTrackingRetry(6, now)).toBeNull();
  });

  it("does not send GA events outside Measurement Protocol backdating windows", () => {
    const now = new Date("2026-10-13T10:00:00.000Z");
    expect(providerTimestampExpired({ timestamp_micros: (now.getTime() - 71 * 60 * 60 * 1000) * 1000 }, now, 72)).toBe(false);
    expect(providerTimestampExpired({ timestamp_micros: (now.getTime() - 73 * 60 * 60 * 1000) * 1000 }, now, 72)).toBe(true);
    expect(providerTimestampExpired({}, now, 72)).toBe(false);
  });
});
