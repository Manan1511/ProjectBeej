import { describe, expect, it } from "vitest";
import { parseTrackingContextInput } from "@/lib/tracking-context-validation";

describe("tracking context request validation", () => {
  it("keeps identifiers only for their matching consent categories", () => {
    const value = parseTrackingContextInput({
      consent: { analytics: true, marketing: false, preferences: true },
      identifiers: { clientId: "123.456", sessionId: "456", gclid: "paid-click-1", fbp: "fb.1.2" },
      attribution: {
        firstTouch: { utm_source: "search", landingPath: "/", capturedAt: "2026-10-13T10:00:00.000Z" },
        lastTouch: { utm_source: "search", landingPath: "/shop", capturedAt: "2026-10-13T10:00:00.000Z" },
      },
    }, "https://beej.example", new Date("2026-10-13T10:01:00.000Z"));

    expect(value?.identifiers).toEqual({ clientId: "123.456", sessionId: "456" });
    expect(value?.attribution?.lastTouch.utm_source).toBe("search");
  });

  it("rejects extra properties and malformed consent", () => {
    expect(parseTrackingContextInput({ consent: { analytics: true, marketing: false, preferences: false, extra: true } }, "https://beej.example")).toBeNull();
    expect(parseTrackingContextInput({ consent: { analytics: true, marketing: "yes", preferences: false } }, "https://beej.example")).toBeNull();
  });

  it("rejects user-supplied URLs and contact data in attribution", () => {
    const body = {
      consent: { analytics: true, marketing: true, preferences: false },
      attribution: {
        firstTouch: { utm_source: "search", landingPath: "/", capturedAt: "2026-10-13T10:00:00.000Z" },
        lastTouch: { utm_campaign: "person@example.com", landingPath: "/shop", capturedAt: "2026-10-13T10:00:00.000Z" },
      },
    };
    expect(parseTrackingContextInput(body, "https://beej.example", new Date("2026-10-13T10:01:00.000Z"))).toBeNull();
  });
});
