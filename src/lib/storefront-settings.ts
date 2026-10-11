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

export function parseHomeCopy(value: unknown): HomeCopy | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const copy: HomeCopy = {};
  for (const [key, limit] of Object.entries(homeCopyLimits) as Array<[keyof HomeCopy, number]>) {
    const text = source[key];
    if (typeof text !== "string") continue;
    const cleaned = text.trim().slice(0, limit);
    if (cleaned) copy[key] = cleaned;
  }

  return Object.keys(copy).length ? copy : undefined;
}
