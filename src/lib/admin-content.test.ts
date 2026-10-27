import { describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_CONTENT,
  changedAdminSections,
  contentFromSettings,
  mergeAdminContent,
  parseAdminContent,
  stableContentHash,
} from "./admin-content";

describe("admin managed storefront content", () => {
  it("starts from the current storefront design with every optional section enabled", () => {
    expect(DEFAULT_ADMIN_CONTENT.visibility.homeAthletes).toBe(true);
    expect(DEFAULT_ADMIN_CONTENT.homeCopy.teamTitle).toBe("Snacking is a sport.");
    expect(DEFAULT_ADMIN_CONTENT.announcement).toBe("Free shipping on orders above ₹499 🌱");
    expect(DEFAULT_ADMIN_CONTENT.featuredHandles).toHaveLength(4);
  });

  it("accepts approved copy with the shipping threshold and preserves text safely", () => {
    const input = structuredClone(DEFAULT_ADMIN_CONTENT);
    input.announcement = "Free shipping on orders above ₹499 🌱";
    input.shopCopy.heroDescriptionLineOne = "Snacks made from nature's humblest ingredients.";
    input.shopCopy.heroDescriptionLineTwo = "Free shipping on orders above ₹499.";

    expect(parseAdminContent(input)).toMatchObject({ success: true, data: {
      announcement: input.announcement,
      shopCopy: input.shopCopy,
    } });
  });

  it("returns field-level errors for invalid URLs, email, and overlong copy", () => {
    const input = structuredClone(DEFAULT_ADMIN_CONTENT);
    input.contactEmail = "not-an-email";
    input.instagramUrl = "javascript:alert(1)";
    input.homeCopy.heroDescription = "x".repeat(321);

    const result = parseAdminContent(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors).toMatchObject({
      contactEmail: expect.any(String),
      instagramUrl: expect.any(String),
      "homeCopy.heroDescription": expect.any(String),
    });
  });

  it("rejects duplicate or excessive featured product handles", () => {
    const input = structuredClone(DEFAULT_ADMIN_CONTENT);
    input.featuredHandles = ["cheese", "cheese", "pudina", "peri-peri", "himalayan-salt-pepper"];

    const result = parseAdminContent(input);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.featuredHandles).toBeTruthy();
  });

  it("produces a stable identity for the same content regardless of object key order", () => {
    const first = { visibility: { homeAthletes: false, homeRibbon: true }, announcement: "Hello" };
    const second = { announcement: "Hello", visibility: { homeRibbon: true, homeAthletes: false } };

    expect(stableContentHash(first)).toBe(stableContentHash(second));
  });

  it("preserves settings keys managed outside this editor", () => {
    const content = contentFromSettings({ featuredHandles: ["cheese"] });
    const merged = mergeAdminContent({
      productBadge: "New",
      legacySetting: { enabled: true },
      homeCopy: { legacyHeading: "Keep this copy" },
      visibility: { experimentalRibbon: true },
    }, content);

    expect(merged).toMatchObject({
      productBadge: "New",
      legacySetting: { enabled: true },
      featuredHandles: ["cheese"],
      homeCopy: { legacyHeading: "Keep this copy" },
      visibility: { experimentalRibbon: true },
    });
  });

  it("reports the page areas that changed", () => {
    const before = structuredClone(DEFAULT_ADMIN_CONTENT);
    const after = structuredClone(DEFAULT_ADMIN_CONTENT);
    after.visibility.homeAthletes = false;
    after.shopCopy.heroTitle = "A new shop heading";
    after.contactEmail = "team@projectbeej.com";

    expect(changedAdminSections(before, after)).toEqual(["Home", "Shop", "Shared"]);
  });
});
