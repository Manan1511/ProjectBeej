export type ProductImage = { url: string; alt: string };
export type ProductVariant = {
  id: string;
  title: string;
  sku?: string | null;
  barcode?: string | null;
  compareAtPrice?: { amount: string; currencyCode: string } | null;
  availableForSale: boolean;
  quantityAvailable?: number | null;
  price: { amount: string; currencyCode: string };
  selectedOptions: Array<{ name: string; value: string }>;
};
export type ProductFaq = { question: string; answer: string };
export type ProductReview = { author: string; rating: number; title?: string; body: string };
export type BeejProduct = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  vendor?: string;
  seo?: { title?: string | null; description?: string | null } | null;
  updatedAt?: string;
  productType: string;
  images: ProductImage[];
  variants: ProductVariant[];
  price: { amount: string; currencyCode: string };
  availableForSale: boolean;
  collectionHandles: string[];
  metafields: Record<string, string>;
  preview: boolean;
};

export type CartLine = {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    availableForSale: boolean;
    quantityAvailable?: number | null;
    price: { amount: string; currencyCode: string };
    selectedOptions: Array<{ name: string; value: string }>;
    product: {
      id: string;
      title: string;
      handle: string;
      productType: string;
      featuredImage?: ProductImage | null;
    };
  };
};

export type ShopifyCart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    subtotalAmount: { amount: string; currencyCode: string };
    totalAmount: { amount: string; currencyCode: string };
  };
  lines: CartLine[];
};

export type ShopifyCartSnapshot = {
  totalQuantity: number;
  lines: Array<{ id: string; quantity: number; merchandise: { id: string } }>;
};

export type HomeCopy = Partial<Record<
  | "heroEyebrow"
  | "heroTitleLineOne"
  | "heroTitleLineTwo"
  | "heroDescription"
  | "heroShopLabel"
  | "heroStoryLabel"
  | "shopEyebrow"
  | "shopHeadingLead"
  | "shopHeadingEmphasis"
  | "storyEyebrow"
  | "storyTitleLineOne"
  | "storyTitleHighlight"
  | "storyTitleTail"
  | "storyDescription"
  | "storyCta"
  | "newsletterEyebrow"
  | "newsletterTitleLead"
  | "newsletterTitleEmphasis"
  | "newsletterDescription"
  | "featuredTitle"
  | "featuredLinkLabel"
  | "teamEyebrow"
  | "teamTitle"
  | "teamDescription"
  | "valuesTitle"
  | "valueOneTitle"
  | "valueOneDescription"
  | "valueTwoTitle"
  | "valueTwoDescription"
  | "valueThreeTitle"
  | "valueThreeDescription"
  | "communityEyebrow"
  | "communityTitle"
  | "communityLinkLabel",
  string
>>;

export type SiteVisibility = Partial<Record<
  | "homeRibbon"
  | "homeFeatured"
  | "homeAthletes"
  | "homeStory"
  | "homeValues"
  | "homeCommunity"
  | "shopSnackSpotted"
  | "shopBenefits"
  | "aboutIntroGallery"
  | "aboutSeedBanner"
  | "aboutBeliefs"
  | "aboutClosing"
  | "announcement"
  | "newsletter",
  boolean
>>;

export type ShopCopy = Partial<Record<
  | "heroEyebrow"
  | "heroTitle"
  | "heroDescriptionLineOne"
  | "heroDescriptionLineTwo"
  | "spottedTitle"
  | "spottedDescription"
  | "seedBannerLineOne"
  | "seedBannerLineTwo"
  | "benefitOneTitle"
  | "benefitOneDescription"
  | "benefitTwoTitle"
  | "benefitTwoDescription"
  | "benefitThreeTitle"
  | "benefitThreeDescription",
  string
>>;

export type AboutCopy = Partial<Record<
  | "heroEyebrow"
  | "heroTitleLineOne"
  | "heroTitleLineTwo"
  | "introTitleLineOne"
  | "introTitleLineTwo"
  | "introTitleEmphasis"
  | "introParagraphOne"
  | "introParagraphTwo"
  | "introParagraphThree"
  | "seedEyebrow"
  | "seedTitleLineOne"
  | "seedTitleLineTwo"
  | "beliefsTitle"
  | "beliefOneTitle"
  | "beliefOneDescription"
  | "beliefTwoTitle"
  | "beliefTwoDescription"
  | "beliefThreeTitle"
  | "beliefThreeDescription"
  | "closingTitle"
  | "closingButtonLabel",
  string
>>;

export type FooterCopy = Partial<Record<"tagline" | "location", string>>;

export type SiteSettings = {
  contentVersion?: number;
  shopId?: string;
  currencyCode?: string;
  announcement?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  contactEmail?: string;
  featuredHandles?: string[];
  slides?: Array<{ src: string; alt: string }>;
  visibility?: SiteVisibility;
  homeCopy?: HomeCopy;
  shopCopy?: ShopCopy;
  aboutCopy?: AboutCopy;
  footerCopy?: FooterCopy;
};
