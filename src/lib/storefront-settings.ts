import type { AboutCopy, FooterCopy, HomeCopy, ShopCopy, SiteVisibility } from "@/lib/types";

const homeCopyLimits: Partial<Record<keyof HomeCopy, number>> = {
  heroEyebrow: 90,
  heroTitleLineOne: 80,
  heroTitleLineTwo: 80,
  heroDescription: 320,
  heroShopLabel: 48,
  heroStoryLabel: 48,
  shopEyebrow: 90,
  shopHeadingLead: 80,
  shopHeadingEmphasis: 80,
  storyEyebrow: 90,
  storyTitleLineOne: 120,
  storyTitleHighlight: 80,
  storyTitleTail: 100,
  storyDescription: 500,
  storyCta: 48,
  newsletterEyebrow: 90,
  newsletterTitleLead: 80,
  newsletterTitleEmphasis: 80,
  newsletterDescription: 320,
  featuredTitle: 80,
  featuredLinkLabel: 48,
  teamEyebrow: 80,
  teamTitle: 100,
  teamDescription: 320,
  valuesTitle: 100,
  valueOneTitle: 80,
  valueOneDescription: 240,
  valueTwoTitle: 80,
  valueTwoDescription: 240,
  valueThreeTitle: 80,
  valueThreeDescription: 240,
  communityEyebrow: 90,
  communityTitle: 80,
  communityLinkLabel: 48,
};

const shopCopyLimits: Partial<Record<keyof ShopCopy, number>> = {
  heroEyebrow: 90, heroTitle: 80, heroDescriptionLineOne: 180, heroDescriptionLineTwo: 180,
  spottedTitle: 80, spottedDescription: 180, seedBannerLineOne: 60, seedBannerLineTwo: 60,
  benefitOneTitle: 80, benefitOneDescription: 180, benefitTwoTitle: 80, benefitTwoDescription: 180,
  benefitThreeTitle: 80, benefitThreeDescription: 180,
};

const aboutCopyLimits: Partial<Record<keyof AboutCopy, number>> = {
  heroEyebrow: 90, heroTitleLineOne: 120, heroTitleLineTwo: 120, introTitleLineOne: 120, introTitleLineTwo: 120,
  introTitleEmphasis: 120, introParagraphOne: 500, introParagraphTwo: 500, introParagraphThree: 300, seedEyebrow: 90,
  seedTitleLineOne: 80, seedTitleLineTwo: 80, beliefsTitle: 100, beliefOneTitle: 80, beliefOneDescription: 240,
  beliefTwoTitle: 80, beliefTwoDescription: 240, beliefThreeTitle: 80, beliefThreeDescription: 240,
  closingTitle: 100, closingButtonLabel: 48,
};

const footerCopyLimits: Partial<Record<keyof FooterCopy, number>> = { tagline: 180, location: 120 };
const visibilityKeys: Array<keyof SiteVisibility> = [
  "homeRibbon", "homeFeatured", "homeAthletes", "homeStory", "homeValues", "homeCommunity", "shopSnackSpotted",
  "shopBenefits", "aboutIntroGallery", "aboutSeedBanner", "aboutBeliefs", "aboutClosing", "announcement", "newsletter",
];

function readPlainText(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > limit || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(cleaned)) return undefined;
  return cleaned;
}

export function parseAnnouncement(value: unknown): string | undefined {
  return readPlainText(value, 160);
}

export function parseHomeCopy(value: unknown): HomeCopy | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const copy: HomeCopy = {};
  for (const [key, limit] of Object.entries(homeCopyLimits) as Array<[keyof HomeCopy, number]>) {
    const cleaned = readPlainText(source[key], limit);
    if (cleaned) copy[key] = cleaned;
  }

  return Object.keys(copy).length ? copy : undefined;
}

function parseCopy<T extends Record<string, unknown>>(value: unknown, limits: Partial<Record<keyof T, number>>): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, limit] of Object.entries(limits) as Array<[string, number]>) {
    const text = readPlainText(source[key], limit);
    if (text) result[key] = text;
  }
  return Object.keys(result).length ? result as T : undefined;
}

export function parseShopCopy(value: unknown): ShopCopy | undefined { return parseCopy<ShopCopy>(value, shopCopyLimits); }
export function parseAboutCopy(value: unknown): AboutCopy | undefined { return parseCopy<AboutCopy>(value, aboutCopyLimits); }
export function parseFooterCopy(value: unknown): FooterCopy | undefined { return parseCopy<FooterCopy>(value, footerCopyLimits); }

export function parseSiteVisibility(value: unknown): SiteVisibility | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: Partial<SiteVisibility> = {};
  for (const key of visibilityKeys) if (typeof source[key] === "boolean") result[key] = source[key] as boolean;
  return Object.keys(result).length ? result : undefined;
}

export function parseStorefrontSlides(value: unknown): Array<{ src: string; alt: string }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((slide) => {
    if (!slide || typeof slide !== "object") return [];

    const item = slide as Record<string, unknown>;
    if (typeof item.image !== "string") return [];

    const src = item.image.startsWith("/assets/") || item.image.startsWith("https://cdn.shopify.com/") ? item.image : "";
    const alt = readPlainText(item.alt, 160);
    return src && alt ? [{ src, alt }] : [];
  }).slice(0, 8);
}
