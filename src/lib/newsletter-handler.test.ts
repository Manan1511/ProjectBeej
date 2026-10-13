import { describe, expect, it, vi } from "vitest";
import { handleNewsletterSubmission } from "@/lib/newsletter-handler";

const deps = (overrides: Partial<Parameters<typeof handleNewsletterSubmission>[2]> = {}) => ({
  secret: () => "a-secret-long-enough-for-hmac-signing-123456789",
  rateLimit: vi.fn(async () => true),
  subscribe: vi.fn(async () => undefined),
  ...overrides,
});

describe("newsletter endpoint", () => {
  it("requires explicit consent and does not store invalid submissions", async () => {
    const injected = deps();
    const response = await handleNewsletterSubmission(new Request("https://beej.test/api/newsletter", { method: "POST", body: JSON.stringify({ email: "seed@example.com", consent: false }) }), "203.0.113.9", injected);
    expect(response.status).toBe(400);
    expect(injected.rateLimit).not.toHaveBeenCalled();
    expect(injected.subscribe).not.toHaveBeenCalled();
  });

  it("stores only an HMAC rate-limit key and subscribes after opt-in", async () => {
    const rateLimit = vi.fn(async (key: string) => Boolean(key));
    const injected = deps({ rateLimit });
    const response = await handleNewsletterSubmission(new Request("https://beej.test/api/newsletter", { method: "POST", body: JSON.stringify({ email: "Seed@example.com", consent: true }) }), "203.0.113.9", injected);
    expect(response.status).toBe(200);
    const bucket = rateLimit.mock.calls[0]?.[0];
    expect(bucket).toMatch(/^[a-f0-9]{64}$/);
    expect(bucket).not.toContain("203.0.113.9");
    expect(injected.subscribe).toHaveBeenCalledWith("seed@example.com");
  });

  it("does not subscribe when rate limit storage rejects the request", async () => {
    const injected = deps({ rateLimit: vi.fn(async () => false) });
    const response = await handleNewsletterSubmission(new Request("https://beej.test/api/newsletter", { method: "POST", body: JSON.stringify({ email: "seed@example.com", consent: true }) }), null, injected);
    expect(response.status).toBe(429);
    expect(injected.subscribe).not.toHaveBeenCalled();
  });

  it("accepts the honeypot silently without reaching persistence", async () => {
    const injected = deps();
    const response = await handleNewsletterSubmission(new Request("https://beej.test/api/newsletter", { method: "POST", body: JSON.stringify({ company: "bot" }) }), null, injected);
    expect(response.status).toBe(200);
    expect(injected.rateLimit).not.toHaveBeenCalled();
    expect(injected.subscribe).not.toHaveBeenCalled();
  });
});
