import { describe, expect, it } from "vitest";
import { newsletterInputSchema } from "./newsletter-validation";

describe("newsletter subscription", () => {
  it("requires an explicit opt-in and normalizes valid email addresses", () => {
    expect(newsletterInputSchema.parse({ email: "  Seed@Example.com ", consent: true }).email).toBe("seed@example.com");
    expect(newsletterInputSchema.safeParse({ email: "seed@example.com", consent: false }).success).toBe(false);
  });

  it("rejects malformed email and non-empty honeypot values", () => {
    expect(newsletterInputSchema.safeParse({ email: "not-email", consent: true }).success).toBe(false);
    expect(newsletterInputSchema.safeParse({ email: "seed@example.com", consent: true, company: "spam" }).success).toBe(false);
  });
});
