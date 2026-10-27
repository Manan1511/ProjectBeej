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

  it("rejects copy over its limit and drops empty values", () => {
    const parsed = parseHomeCopy({ heroDescription: ` ${"a".repeat(600)} `, storyDescription: "   " });
    expect(parsed).toBeUndefined();
  });

  it("returns no override when the value is empty or malformed", () => {
    expect(parseHomeCopy(undefined)).toBeUndefined();
    expect(parseHomeCopy([])).toBeUndefined();
    expect(parseHomeCopy({})).toBeUndefined();
  });

  it("preserves approved merchant copy including prices and shipping details", () => {
    const parsed = parseHomeCopy({
      heroDescription: "Wholesome snacks with high protein and no preservatives.",
      storyDescription: "Made in India and delivered free over ₹499.",
      heroShopLabel: "Shop now",
    });

    expect(parsed).toEqual({
      heroDescription: "Wholesome snacks with high protein and no preservatives.",
      storyDescription: "Made in India and delivered free over ₹499.",
      heroShopLabel: "Shop now",
    });
  });

  it("accepts the current free shipping announcement with its price", () => {
    expect(parseAnnouncement("Welcome to snacking that’s rooted in nature 🌱")).toBe("Welcome to snacking that’s rooted in nature 🌱");
    expect(parseAnnouncement("Free shipping on orders above ₹499 🌱")).toBe("Free shipping on orders above ₹499 🌱");
  });

  it("parses versioned content, visibility, and copy without trusting arbitrary values", async () => {
    const { parseShopCopy, parseAboutCopy, parseFooterCopy, parseSiteVisibility } = await import("./storefront-settings");
    expect(parseSiteVisibility({ homeAthletes: false, newsletter: true, ignored: false })).toEqual({ homeAthletes: false, newsletter: true });
    expect(parseShopCopy({ heroTitle: "Pantry", benefitOneTitle: "Shipping", unknown: "ignored", seedBannerLineOne: "Start" })).toEqual({ heroTitle: "Pantry", benefitOneTitle: "Shipping", seedBannerLineOne: "Start" });
    expect(parseAboutCopy({ heroTitleLineOne: "Rooted", beliefOneDescription: "Honest", unknown: "ignored" })).toEqual({ heroTitleLineOne: "Rooted", beliefOneDescription: "Honest" });
    expect(parseFooterCopy({ tagline: "Rooted in nature", location: "Surat", unknown: "ignored" })).toEqual({ tagline: "Rooted in nature", location: "Surat" });
  });

  it("trims valid merchant copy without silently truncating it", () => {
    expect(parseAnnouncement("  Free delivery on every order  ")).toBe("Free delivery on every order");
    expect(parseAnnouncement("a".repeat(161))).toBeUndefined();
  });

  it("filters invalid slide sources and keeps plain descriptive alt text", () => {
    expect(parseStorefrontSlides([
      { image: "/assets/hero.webp", alt: "Roasted makhana, high in protein" },
      { image: "https://example.com/hero.webp", alt: "Project Beej snack pack" },
      { image: "/assets/hero.webp", alt: "Project Beej snack pack on a bright table." },
    ])).toEqual([
      { src: "/assets/hero.webp", alt: "Roasted makhana, high in protein" },
      { src: "/assets/hero.webp", alt: "Project Beej snack pack on a bright table." },
    ]);
  });
});
