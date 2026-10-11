export type ProductImage = { url: string; alt: string };
export type ProductVariant = {
  id: string;
  title: string;
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
  | "newsletterDescription",
  string
>>;

export type SiteSettings = {
  announcement?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
  contactEmail?: string;
  featuredHandles?: string[];
  slides?: Array<{ src: string; alt: string }>;
  homeCopy?: HomeCopy;
};
