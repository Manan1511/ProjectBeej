import { describe, expect, it } from "vitest";
import { parseHomeCopy } from "./storefront-settings";

describe("Shopify-managed homepage copy", () => {
  it("trims supported text fields and ignores unknown or non-text values", () => {
    expect(parseHomeCopy({
      heroEyebrow: "  Rooted in nature  ",
      heroTitleLineOne: 42,
      unexpected: "ignored",
    })).toEqual({ heroEyebrow: "Rooted in nature" });
  });

  it("bounds copy length and drops empty values", () => {
    const parsed = parseHomeCopy({ heroDescription: ` ${"a".repeat(600)} `, storyDescription: "   " });
    expect(parsed?.heroDescription).toHaveLength(320);
    expect(parsed).not.toHaveProperty("storyDescription");
  });

  it("returns no override when the value is empty or malformed", () => {
    expect(parseHomeCopy(undefined)).toBeUndefined();
    expect(parseHomeCopy([])).toBeUndefined();
    expect(parseHomeCopy({})).toBeUndefined();
  });
});
