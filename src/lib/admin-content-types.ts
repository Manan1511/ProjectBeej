import type { AboutCopy, FooterCopy, HomeCopy, ShopCopy, SiteVisibility } from "@/lib/types";

type Complete<T> = { [K in keyof T]-?: string };

export type AdminContent = {
  contentVersion: 1;
  announcement: string;
  contactEmail: string;
  instagramUrl: string;
  whatsappUrl: string;
  featuredHandles: string[];
  visibility: Required<SiteVisibility>;
  homeCopy: Complete<HomeCopy>;
  shopCopy: Complete<ShopCopy>;
  aboutCopy: Complete<AboutCopy>;
  footerCopy: Complete<FooterCopy>;
};
