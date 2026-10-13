import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tracking-security", () => ({ verifyConsentCapability: vi.fn(() => "00000000-0000-4000-8000-000000000001") }));
vi.mock("@/lib/tracking-store", () => ({
  getCheckoutContextById: vi.fn(),
  getCurrentVisitorConsent: vi.fn(),
  recordCheckoutTrackingEvent: vi.fn(),
}));

import { handleCheckoutTrackingEvent } from "@/lib/checkout-event-handler";
import { getCheckoutContextById, getCurrentVisitorConsent, recordCheckoutTrackingEvent } from "@/lib/tracking-store";

const context = {
  context_id: "00000000-0000-4000-8000-000000000001",
  visitor_id: "00000000-0000-4000-8000-000000000002",
  consent: { analytics: true, marketing: false, preferences: false },
  identifiers: { clientId: "123.456", sessionId: "98765" },
  attribution: null,
  client_ip: null,
  user_agent: null,
};

function request(name = "checkout_completed") {
  return new Request("https://beej.example/api/tracking/checkout-event", {
    method: "POST",
    headers: { origin: "https://beej.example", "content-type": "application/json" },
    body: JSON.stringify({ capability: "signed-test", eventId: "event_12345678", name }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Shopify checkout event bridge", () => {
  it("sends only consented checkout diagnostics to the server-configured GA4 stream", async () => {
    vi.stubEnv("SITE_URL", "https://beej.example");
    vi.stubEnv("NEXT_PUBLIC_TRACKING_MODE", "production");
    vi.stubEnv("CONTEXT", "production");
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-BEEJ1234");
    vi.stubEnv("GA4_API_SECRET", "server-secret-for-test-only");
    vi.stubEnv("TRACKING_SIGNING_SECRET", "a-secret-long-enough-for-test-context-signing");
    vi.mocked(getCheckoutContextById).mockResolvedValue(context);
    vi.mocked(getCurrentVisitorConsent).mockResolvedValue({ analytics: true, marketing: false, preferences: false });
    vi.mocked(recordCheckoutTrackingEvent).mockResolvedValue(true);
    let sentBody: unknown;
    vi.stubGlobal("fetch", vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response("ok", { status: 200 });
    }));

    const response = await handleCheckoutTrackingEvent(request());
    expect(response.status).toBe(200);
    expect(sentBody).toMatchObject({ client_id: "123.456", events: [{ name: "checkout_completed_diagnostic", params: { session_id: "98765", page_location: "https://beej.example/checkout" } }] });
    expect(JSON.stringify(sentBody)).not.toContain("transaction_id");
  });

  it("does not send a checkout event after analytics consent is absent or withdrawn", async () => {
    vi.stubEnv("SITE_URL", "https://beej.example");
    vi.stubEnv("TRACKING_SIGNING_SECRET", "a-secret-long-enough-for-test-context-signing");
    vi.mocked(getCheckoutContextById).mockResolvedValue({ ...context, consent: { ...context.consent, analytics: false } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleCheckoutTrackingEvent(request("payment_info_submitted"));
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects origins outside the configured checkout allowlist", async () => {
    vi.stubEnv("SITE_URL", "https://beej.example");
    const input = request();
    const invalid = new Request(input.url, { method: input.method, headers: { origin: "https://attacker.example", "content-type": "application/json" }, body: await input.text() });
    const response = await handleCheckoutTrackingEvent(invalid);
    expect(response.status).toBe(403);
    expect(getCheckoutContextById).not.toHaveBeenCalled();
  });
});
