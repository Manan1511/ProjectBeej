import { describe, expect, it } from "vitest";
import {
  captureCampaignTouch,
  captureClickIdentifiers,
  mergeAttribution,
  sanitizeAttributionState,
  sanitizeSearchTerm,
} from "@/lib/tracking-attribution";

describe("tracking attribution", () => {
  it("keeps only approved UTM fields and strips arbitrary query data", () => {
    const touch = captureCampaignTouch(
      "https://beej.example/shop?utm_source=Instagram&utm_medium=paid%20social&utm_campaign=diwali&utm_term=roasted%20snack&email=hello%40example.com&token=secret",
      "https://www.instagram.com/reel/123?user=private",
      "https://beej.example",
      new Date("2026-10-13T10:00:00.000Z"),
    );

    expect(touch).toEqual({
      utm_source: "Instagram",
      utm_medium: "paid social",
      utm_campaign: "diwali",
      utm_term: "roasted snack",
      landingPath: "/shop",
      referrerOrigin: "https://www.instagram.com",
      capturedAt: "2026-10-13T10:00:00.000Z",
    });
  });

  it("rejects campaign values that contain contact data", () => {
    expect(captureCampaignTouch(
      "https://beej.example/shop?utm_source=hello%40example.com&utm_medium=paid",
      "",
      "https://beej.example",
    )).toBeNull();
  });

  it("does not replace saved first or latest touch on direct and internal visits", () => {
    const saved = {
      firstTouch: { utm_source: "instagram", landingPath: "/", capturedAt: "2026-10-01T00:00:00.000Z" },
      lastTouch: { utm_source: "google", landingPath: "/shop", capturedAt: "2026-10-10T00:00:00.000Z" },
    };

    expect(mergeAttribution(saved, null)).toEqual(saved);
    const internal = captureCampaignTouch(
      "https://beej.example/products/pudina?utm_source=internal",
      "https://beej.example/shop",
      "https://beej.example",
    );
    expect(internal).toBeNull();
    expect(mergeAttribution(saved, internal)).toEqual(saved);
  });

  it("records a new non-direct touch as latest while preserving first touch", () => {
    const saved = {
      firstTouch: { utm_source: "instagram", landingPath: "/", capturedAt: "2026-10-01T00:00:00.000Z" },
      lastTouch: { utm_source: "google", landingPath: "/shop", capturedAt: "2026-10-10T00:00:00.000Z" },
    };

    expect(mergeAttribution(saved, {
      utm_source: "newsletter",
      utm_campaign: "october",
      landingPath: "/shop",
      capturedAt: "2026-10-13T10:00:00.000Z",
    })).toEqual({ firstTouch: saved.firstTouch, lastTouch: {
      utm_source: "newsletter",
      utm_campaign: "october",
      landingPath: "/shop",
      capturedAt: "2026-10-13T10:00:00.000Z",
    } });
  });

  it("keeps advertising click identifiers only after marketing consent", () => {
    const url = "https://beej.example/shop?gclid=click-123&fbclid=meta-456&wbraid=braid-789";
    expect(captureClickIdentifiers(url, "_fbp=fb.1.1; _fbc=fb.1.2", false)).toEqual({});
    expect(captureClickIdentifiers(url, "_fbp=fb.1.1; _fbc=fb.1.2", true)).toEqual({
      gclid: "click-123",
      wbraid: "braid-789",
      fbclid: "meta-456",
      fbp: "fb.1.1",
      fbc: "fb.1.2",
    });
  });

  it("redacts email addresses, phone numbers and query syntax from search telemetry", () => {
    expect(sanitizeSearchTerm("peri peri makhana")).toBe("peri peri makhana");
    expect(sanitizeSearchTerm("hello@example.com makhana")).toBe("");
    expect(sanitizeSearchTerm("Call 9876543210")).toBe("");
    expect(sanitizeSearchTerm("red&token=abc")).toBe("red");
  });

  it("revalidates server-submitted attribution and drops unsafe identifiers", () => {
    const safe = {
      firstTouch: { utm_source: "instagram", landingPath: "/", capturedAt: "2026-10-13T10:00:00.000Z" },
      lastTouch: { utm_source: "google", landingPath: "/shop", capturedAt: "2026-10-13T10:00:00.000Z" },
    };
    expect(sanitizeAttributionState(safe, "https://beej.example", new Date("2026-10-13T10:01:00.000Z"))).toEqual(safe);
    expect(sanitizeAttributionState({ ...safe, lastTouch: { ...safe.lastTouch, landingPath: "https://evil.example/checkout?key=x" } }, "https://beej.example")).toBeNull();
    expect(sanitizeAttributionState({ ...safe, lastTouch: { ...safe.lastTouch, utm_campaign: "user@example.com" } }, "https://beej.example")).toBeNull();
  });
});
