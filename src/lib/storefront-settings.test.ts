import { describe, expect, it } from "vitest";
import { parseAnnouncement, parseHomeCopy, parseStorefrontSlides } from "./storefront-settings";

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

  it("drops copy with unverified health, ingredient, origin, delivery, or price claims", () => {
    const parsed = parseHomeCopy({
      heroDescription: "Wholesome snacks with high protein and no preservatives.",
      storyDescription: "Made in India and delivered free over ₹499.",
      heroShopLabel: "Shop now",
    });

    expect(parsed).toEqual({ heroShopLabel: "Shop now" });
  });

  it("applies the same content guard to the announcement", () => {
    expect(parseAnnouncement("Welcome to snacking that’s rooted in nature 🌱")).toBe("Welcome to snacking that’s rooted in nature 🌱");
    expect(parseAnnouncement("Free delivery on every order")).toBeUndefined();
  });

  it("blocks common health and discount claims in merchant-managed copy", () => {
    expect(parseAnnouncement("A snack that is high in protein")).toBeUndefined();
    expect(parseAnnouncement("20% off today only")).toBeUndefined();
    expect(parseAnnouncement("A low in sugar snack")).toBeUndefined();
    expect(parseAnnouncement("10 percent off today only")).toBeUndefined();
  });

  it("filters carousel slides with unverified alt text and preserves safe slide text", () => {
    expect(parseStorefrontSlides([
      { image: "/assets/hero.webp", alt: "High in protein" },
      { image: "https://cdn.shopify.com/s/files/1/hero.webp", alt: "20% off today" },
      { image: "/assets/hero.webp", alt: "Project Beej snack pack on a bright table." },
    ])).toEqual([
      { src: "/assets/hero.webp", alt: "Project Beej snack pack on a bright table." },
    ]);
  });
});
