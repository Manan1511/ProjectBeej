import type { HomeCopy } from "@/lib/types";

const homeCopyLimits: Record<keyof HomeCopy, number> = {
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
};

const unverifiedClaimPattern = /\b(?:healthy|healthier|health|wholesome|nutrition(?:al)?|nutrient(?:s)?|ingredient(?:s)?|allergen(?:s)?|gluten[- ]free|high[- ](?:in[- ])?(?:protein|fibre|fiber)|protein[- ]rich|low[- ](?:in[- ])?(?:fat|sugar|calorie(?:s)?)|jain[- ]friendly|vegan|organic|preservative[- ]free|no preservatives?|all[- ]natural|free shipping|free delivery|cash on delivery|tax(?:es)? included|made in india|grown in india|packed in india|sourced from india)\b/i;
const discountClaimPattern = /\b\d{1,3}\s*(?:%|percent)\s*(?:off|discount|savings?)\b|\bsave\s+\d{1,3}\s*(?:%|percent)/i;
const priceClaimPattern = /(?:₹|INR\s*)\s*[\d,.]+/i;

function cleanApprovedCopy(value: unknown, limit: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().slice(0, limit);
  if (!cleaned || unverifiedClaimPattern.test(cleaned) || discountClaimPattern.test(cleaned) || priceClaimPattern.test(cleaned)) return undefined;
  return cleaned;
}

export function parseAnnouncement(value: unknown): string | undefined {
  return cleanApprovedCopy(value, 160);
}

export function parseHomeCopy(value: unknown): HomeCopy | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const copy: HomeCopy = {};
  for (const [key, limit] of Object.entries(homeCopyLimits) as Array<[keyof HomeCopy, number]>) {
    const cleaned = cleanApprovedCopy(source[key], limit);
    if (cleaned) copy[key] = cleaned;
  }

  return Object.keys(copy).length ? copy : undefined;
}

export function parseStorefrontSlides(value: unknown): Array<{ src: string; alt: string }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((slide) => {
    if (!slide || typeof slide !== "object") return [];

    const item = slide as Record<string, unknown>;
    if (typeof item.image !== "string") return [];

    const src = item.image.startsWith("/assets/") || item.image.startsWith("https://cdn.shopify.com/") ? item.image : "";
    const alt = parseAnnouncement(item.alt);
    return src && alt ? [{ src, alt }] : [];
  }).slice(0, 8);
}
