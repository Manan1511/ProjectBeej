import { createHash } from "node:crypto";
import type { SiteSettings, SiteVisibility } from "@/lib/types";
import { DEFAULT_ADMIN_CONTENT } from "@/lib/admin-content-defaults";
import type { AdminContent } from "@/lib/admin-content-types";

export { DEFAULT_ADMIN_CONTENT };
export type { AdminContent };

export type AdminContentParseResult = { success: true; data: AdminContent } | { success: false; errors: Record<string, string> };

const copyLimits: Record<string, number> = {
  "homeCopy.heroEyebrow": 90,
  "homeCopy.heroTitleLineOne": 80,
  "homeCopy.heroTitleLineTwo": 80,
  "homeCopy.heroDescription": 320,
  "homeCopy.heroShopLabel": 48,
  "homeCopy.heroStoryLabel": 48,
  "homeCopy.featuredTitle": 80,
  "homeCopy.featuredLinkLabel": 48,
  "homeCopy.teamEyebrow": 80,
  "homeCopy.teamTitle": 100,
  "homeCopy.teamDescription": 320,
  "homeCopy.storyTitleLineOne": 120,
  "homeCopy.storyTitleHighlight": 100,
  "homeCopy.storyDescription": 500,
  "homeCopy.storyCta": 48,
  "homeCopy.valuesTitle": 100,
  "homeCopy.valueOneTitle": 80,
  "homeCopy.valueOneDescription": 240,
  "homeCopy.valueTwoTitle": 80,
  "homeCopy.valueTwoDescription": 240,
  "homeCopy.valueThreeTitle": 80,
  "homeCopy.valueThreeDescription": 240,
  "homeCopy.communityEyebrow": 90,
  "homeCopy.communityTitle": 80,
  "homeCopy.communityLinkLabel": 48,
  "shopCopy.heroEyebrow": 90,
  "shopCopy.heroTitle": 80,
  "shopCopy.heroDescriptionLineOne": 180,
  "shopCopy.heroDescriptionLineTwo": 180,
  "shopCopy.spottedTitle": 80,
  "shopCopy.spottedDescription": 180,
  "shopCopy.seedBannerLineOne": 60,
  "shopCopy.seedBannerLineTwo": 60,
  "shopCopy.benefitOneTitle": 80,
  "shopCopy.benefitOneDescription": 180,
  "shopCopy.benefitTwoTitle": 80,
  "shopCopy.benefitTwoDescription": 180,
  "shopCopy.benefitThreeTitle": 80,
  "shopCopy.benefitThreeDescription": 180,
  "aboutCopy.heroEyebrow": 90,
  "aboutCopy.heroTitleLineOne": 120,
  "aboutCopy.heroTitleLineTwo": 120,
  "aboutCopy.introTitleLineOne": 120,
  "aboutCopy.introTitleLineTwo": 120,
  "aboutCopy.introTitleEmphasis": 120,
  "aboutCopy.introParagraphOne": 500,
  "aboutCopy.introParagraphTwo": 500,
  "aboutCopy.introParagraphThree": 300,
  "aboutCopy.seedEyebrow": 90,
  "aboutCopy.seedTitleLineOne": 80,
  "aboutCopy.seedTitleLineTwo": 80,
  "aboutCopy.beliefsTitle": 100,
  "aboutCopy.beliefOneTitle": 80,
  "aboutCopy.beliefOneDescription": 240,
  "aboutCopy.beliefTwoTitle": 80,
  "aboutCopy.beliefTwoDescription": 240,
  "aboutCopy.beliefThreeTitle": 80,
  "aboutCopy.beliefThreeDescription": 240,
  "aboutCopy.closingTitle": 100,
  "aboutCopy.closingButtonLabel": 48,
  "footerCopy.tagline": 180,
  "footerCopy.location": 120,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeCopy<T extends Record<string, string>>(defaults: T, value: unknown): T {
  if (!isObject(value)) return defaults;
  const merged = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    if (typeof value[key as string] === "string") merged[key] = (value[key as string] as string).trim() as T[keyof T];
  }
  return merged;
}

export function contentFromSettings(settings: SiteSettings | Record<string, unknown> = {}): AdminContent {
  const value = settings as Record<string, unknown>;
  const visibility = isObject(value.visibility) ? value.visibility : {};
  const homeCopy = mergeCopy(DEFAULT_ADMIN_CONTENT.homeCopy, value.homeCopy);
  const shopCopy = mergeCopy(DEFAULT_ADMIN_CONTENT.shopCopy, value.shopCopy);
  const aboutCopy = mergeCopy(DEFAULT_ADMIN_CONTENT.aboutCopy, value.aboutCopy);
  const footerCopy = mergeCopy(DEFAULT_ADMIN_CONTENT.footerCopy, value.footerCopy);
  return {
    contentVersion: 1,
    announcement: typeof value.announcement === "string" ? value.announcement.trim() : DEFAULT_ADMIN_CONTENT.announcement,
    contactEmail: typeof value.contactEmail === "string" ? value.contactEmail.trim() : DEFAULT_ADMIN_CONTENT.contactEmail,
    instagramUrl: typeof value.instagramUrl === "string" ? value.instagramUrl.trim() : DEFAULT_ADMIN_CONTENT.instagramUrl,
    whatsappUrl: typeof value.whatsappUrl === "string" ? value.whatsappUrl.trim() : DEFAULT_ADMIN_CONTENT.whatsappUrl,
    featuredHandles: Array.isArray(value.featuredHandles) && value.featuredHandles.every((handle) => typeof handle === "string")
      ? value.featuredHandles.slice(0, 4) as string[]
      : [...DEFAULT_ADMIN_CONTENT.featuredHandles],
    visibility: Object.fromEntries(Object.entries(DEFAULT_ADMIN_CONTENT.visibility).map(([key, fallback]) => [key, typeof visibility[key] === "boolean" ? visibility[key] : fallback])) as Required<SiteVisibility>,
    homeCopy,
    shopCopy,
    aboutCopy,
    footerCopy,
  };
}

function validateTextFields(content: AdminContent, errors: Record<string, string>): void {
  for (const [path, max] of Object.entries(copyLimits)) {
    const [group, key] = path.split(".") as ["homeCopy" | "shopCopy" | "aboutCopy" | "footerCopy", string];
    const value = (content[group] as Record<string, unknown>)[key];
    if (typeof value !== "string" || value.trim().length === 0) errors[path] = "Enter text for this field.";
    else if (value.length > max) errors[path] = `Keep this field under ${max} characters.`;
    else if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) errors[path] = "Remove control characters from this field.";
  }

  if (!content.announcement.trim()) errors.announcement = "Enter announcement text.";
  else if (content.announcement.length > 160) errors.announcement = "Keep the announcement under 160 characters.";
  if (content.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(content.contactEmail)) errors.contactEmail = "Enter a valid contact email.";
  if (content.instagramUrl && !/^https:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+\/?$/.test(content.instagramUrl)) errors.instagramUrl = "Use a valid HTTPS Instagram profile URL.";
  if (content.whatsappUrl && !/^https:\/\/(?:wa\.me\/\d+|api\.whatsapp\.com\/send\?phone=\d+)(?:&[A-Za-z0-9_=-]+)*$/.test(content.whatsappUrl)) errors.whatsappUrl = "Use a valid HTTPS WhatsApp link.";
  if (content.featuredHandles.length > 4 || new Set(content.featuredHandles).size !== content.featuredHandles.length || content.featuredHandles.some((handle) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))) {
    errors.featuredHandles = "Choose up to four different valid Shopify product handles.";
  }
}

export function parseAdminContent(value: unknown): AdminContentParseResult {
  if (!isObject(value)) return { success: false, errors: { form: "The content payload is invalid." } };
  const content = contentFromSettings(value);
  const errors: Record<string, string> = {};
  validateTextFields(content, errors);

  const incomingVisibility = isObject(value.visibility) ? value.visibility : {};
  for (const key of Object.keys(DEFAULT_ADMIN_CONTENT.visibility)) {
    if (typeof incomingVisibility[key] !== "boolean") errors[`visibility.${key}`] = "Choose whether to show this section.";
  }
  if (errors.form || Object.keys(errors).length) return { success: false, errors };
  return { success: true, data: content };
}

export function mergeAdminContent(existing: Record<string, unknown>, content: AdminContent): Record<string, unknown> {
  const existingVisibility = isObject(existing.visibility) ? existing.visibility : {};
  const existingHomeCopy = isObject(existing.homeCopy) ? existing.homeCopy : {};
  const existingShopCopy = isObject(existing.shopCopy) ? existing.shopCopy : {};
  const existingAboutCopy = isObject(existing.aboutCopy) ? existing.aboutCopy : {};
  const existingFooterCopy = isObject(existing.footerCopy) ? existing.footerCopy : {};
  return {
    ...existing,
    contentVersion: 1,
    visibility: { ...existingVisibility, ...content.visibility },
    announcement: content.announcement,
    contactEmail: content.contactEmail,
    instagramUrl: content.instagramUrl,
    whatsappUrl: content.whatsappUrl,
    featuredHandles: content.featuredHandles,
    homeCopy: { ...existingHomeCopy, ...content.homeCopy },
    shopCopy: { ...existingShopCopy, ...content.shopCopy },
    aboutCopy: { ...existingAboutCopy, ...content.aboutCopy },
    footerCopy: { ...existingFooterCopy, ...content.footerCopy },
  };
}

export function resolveAdminSiteSettings(settings: SiteSettings = {}): SiteSettings {
  const content = contentFromSettings(settings);
  return mergeAdminContent(settings as Record<string, unknown>, content) as SiteSettings;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function stableContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function changedAdminSections(before: AdminContent, after: AdminContent): string[] {
  const groups = [
    { label: "Home", keys: ["homeCopy", "featuredHandles", "homeRibbon", "homeFeatured", "homeAthletes", "homeStory", "homeValues", "homeCommunity"] },
    { label: "Shop", keys: ["shopCopy", "shopSnackSpotted", "shopBenefits"] },
    { label: "Our Story", keys: ["aboutCopy", "aboutIntroGallery", "aboutSeedBanner", "aboutBeliefs", "aboutClosing"] },
    { label: "Shared", keys: ["announcement", "contactEmail", "instagramUrl", "whatsappUrl", "footerCopy", "newsletter"] },
  ];
  return groups.flatMap(({ label, keys }) => keys.some((key) => {
    if (key in before.visibility || key in after.visibility) return before.visibility[key as keyof SiteVisibility] !== after.visibility[key as keyof SiteVisibility];
    return JSON.stringify(before[key as keyof AdminContent]) !== JSON.stringify(after[key as keyof AdminContent]);
  }) ? [label] : []);
}
