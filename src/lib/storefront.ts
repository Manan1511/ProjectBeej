import "server-only";
import { readCartCookie } from "@/lib/commerce";
import type { BeejProduct, CartLine, ProductFaq, ProductReview, ShopifyCart, SiteSettings } from "@/lib/types";
import { parseHomeCopy } from "@/lib/storefront-settings";

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-10";
const domain = process.env.SHOPIFY_STORE_DOMAIN || "projectbeej-1686bmnd.myshopify.com";
const previewCatalog = [
  { handle: "peri-peri", title: "Peri Peri", productType: "Roasted Makhana", description: "Chilli heat that lifts heavy. Smoky, tangy, a little loud.", price: "299", tint: "#F5A287", mascot: "/assets/squad-lifter-hq.png", images: ["/assets/peri-drop.jpg", "/assets/peri-flatlay.jpg"], player: "The Lifter" },
  { handle: "cheese", title: "Cheese", productType: "Roasted Makhana", description: "Golden, cheesy and effortlessly cool.", price: "299", tint: "#FFD98E", mascot: "/assets/squad-skater-hq.png", images: ["/assets/cheese-drop.jpg", "/assets/cheese-table.jpg"], player: "The Skater" },
  { handle: "himalayan-salt-pepper", title: "Himalayan Salt & Pepper", productType: "Roasted Makhana", description: "Pink salt, cracked pepper. Never misses.", price: "299", tint: "#F7B3BB", mascot: "/assets/squad-runner-hq.png", images: ["/assets/himalayan-reach.jpg", "/assets/himalayan-hand.jpg", "/assets/himalayan-window.jpg", "/assets/himalayan-yoga.jpg"], player: "The Striker" },
  { handle: "pudina", title: "Pudina", productType: "Roasted Makhana", description: "Cool mint with a sharp finish.", price: "299", tint: "#B9DCA3", mascot: "/assets/squad-pickleball-hq.png", images: ["/assets/pudina-hands.jpg", "/assets/pudina-pop.jpg"], player: "The Smasher" },
  { handle: "classic-makhana", title: "Classic Makhana", productType: "Ready to Roast", description: "Plain and simple. Roast it your way at home.", price: "149", tint: "#C4D19B", mascot: "/assets/makhana-lotus.png", images: ["/assets/makhana-pond.jpg", "/assets/makhana-lotus.jpg", "/assets/pack.jpg"], player: "The Original" },
];

const PRODUCT_FIELDS = `
  id handle title description descriptionHtml productType availableForSale tags
  featuredImage { url altText }
  images(first: 10) { nodes { url altText } }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 50) { nodes { id title availableForSale quantityAvailable price { amount currencyCode } selectedOptions { name value } } }
  collections(first: 10) { nodes { handle } }
  beejFaqs: metafield(namespace: "beej", key: "faqs") { value }
  beejApprovedReviews: metafield(namespace: "beej", key: "approved_reviews") { value }
`;

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

function endpoint(api = "storefront") {
  if (!/^[-a-z0-9]+\.myshopify\.com$/i.test(domain)) throw new Error("SHOPIFY_STORE_DOMAIN must be a Shopify myshopify.com domain.");
  if (!/^\d{4}-\d{2}$/.test(API_VERSION)) throw new Error("SHOPIFY_API_VERSION must use YYYY-MM format.");
  return `https://${domain}/${api === "admin" ? "admin/api" : "api"}/${API_VERSION}/graphql.json`;
}

export function getStorefrontMode(): "preview" | "live" {
  const configured = process.env.SHOPIFY_MODE;
  if (configured === "preview" || configured === "live") return configured;
  return process.env.NODE_ENV === "production" ? "live" : "preview";
}

function storefrontToken(): { value: string; isPrivate: boolean } {
  const privateToken = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  if (privateToken) {
    if (privateToken.startsWith("shpat_")) throw new Error("An Admin API token cannot be used as a Storefront API private token.");
    return { value: privateToken, isPrivate: true };
  }
  const publicToken = process.env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN;
  if (!publicToken) throw new Error("Shopify Storefront API token is not configured.");
  return { value: publicToken, isPrivate: false };
}

function normalizeBuyerIp(value?: string | null): string | undefined {
  if (!value) return undefined;
  const first = value.split(",", 1)[0]?.trim();
  if (!first || first.length > 64 || !/^[0-9a-fA-F:.]+$/.test(first)) return undefined;
  return first;
}

export async function storefrontQuery<T>(
  query: string,
  variables: Record<string, unknown> = {},
  buyerIp?: string | null,
): Promise<T> {
  const token = storefrontToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [token.isPrivate ? "Shopify-Storefront-Private-Token" : "Shopify-Storefront-Access-Token"]: token.value,
  };
  if (token.isPrivate) {
    const safeIp = normalizeBuyerIp(buyerIp);
    if (safeIp) headers["Shopify-Storefront-Buyer-IP"] = safeIp;
  }

  const response = await fetch(endpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}.`);
  const payload = (await response.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) throw new Error(payload.errors[0]?.message || "Shopify Storefront API request failed.");
  if (!payload.data) throw new Error("Shopify Storefront API returned no data.");
  return payload.data;
}

type ShopifyProductRaw = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  productType?: string;
  availableForSale: boolean;
  featuredImage?: { url: string; altText?: string | null } | null;
  images: { nodes: Array<{ url: string; altText?: string | null }> };
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  variants: { nodes: Array<{ id: string; title: string; availableForSale: boolean; quantityAvailable?: number | null; price: { amount: string; currencyCode: string }; selectedOptions: Array<{ name: string; value: string }> }> };
  collections: { nodes: Array<{ handle: string }> };
  beejFaqs?: { value: string } | null;
  beejApprovedReviews?: { value: string } | null;
};

function parseJsonMetafield(value: string | undefined): unknown {
  if (!value) return undefined;
  try { return JSON.parse(value); } catch { return undefined; }
}

export function parseProductFaqs(value: string | undefined): ProductFaq[] {
  const parsed = parseJsonMetafield(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.question !== "string" || typeof item.answer !== "string") return [];
    return [{ question: item.question.slice(0, 160), answer: item.answer.slice(0, 2400) }];
  }).slice(0, 12);
}

export function parseApprovedReviews(value: string | undefined): ProductReview[] {
  const parsed = parseJsonMetafield(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const item = entry as Record<string, unknown>;
    if (typeof item.author !== "string" || typeof item.body !== "string" || !Number.isInteger(item.rating)) return [];
    const rating = Number(item.rating);
    if (rating < 1 || rating > 5) return [];
    return [{ author: item.author.slice(0, 80), body: item.body.slice(0, 1200), rating, title: typeof item.title === "string" ? item.title.slice(0, 120) : undefined }];
  }).slice(0, 50);
}

function mapProduct(raw: ShopifyProductRaw): BeejProduct {
  const images = raw.images.nodes.map((image) => ({ url: image.url, alt: image.altText || raw.title }));
  if (images.length === 0 && raw.featuredImage) images.push({ url: raw.featuredImage.url, alt: raw.featuredImage.altText || raw.title });
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    productType: raw.productType || "Roasted Makhana",
    images,
    variants: raw.variants.nodes,
    price: raw.priceRange.minVariantPrice,
    availableForSale: raw.availableForSale,
    collectionHandles: raw.collections.nodes.map((collection) => collection.handle),
    metafields: { faqs: raw.beejFaqs?.value || "", approvedReviews: raw.beejApprovedReviews?.value || "" },
    preview: getStorefrontMode() === "preview",
  };
}

function mapPreviewProduct(raw: (typeof previewCatalog)[number]): BeejProduct {
  return {
    id: `preview:${raw.handle}`,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    productType: raw.productType,
    images: raw.images.map((url) => ({ url, alt: `${raw.title} Makhana` })),
    variants: [],
    price: { amount: raw.price, currencyCode: "INR" },
    availableForSale: false,
    collectionHandles: [raw.productType === "Ready to Roast" ? "ready-to-roast" : "roasted-makhana"],
    metafields: { faqs: "", approvedReviews: "" },
    preview: true,
  };
}

export const previewProducts = previewCatalog.map(mapPreviewProduct);

async function queryProducts(query: string, variables: Record<string, unknown> = {}, buyerIp?: string | null): Promise<BeejProduct[]> {
  try {
    const data = await storefrontQuery<{ products: { nodes: ShopifyProductRaw[] }; collection?: { products: { nodes: ShopifyProductRaw[] } } }>(query, variables, buyerIp);
    return (data.collection?.products.nodes ?? data.products.nodes).map(mapProduct);
  } catch (error) {
    if (getStorefrontMode() === "preview") return [];
    throw error;
  }
}

export async function getProducts(buyerIp?: string | null): Promise<BeejProduct[]> {
  const products = await queryProducts(`query BeejProducts { products(first: 20, sortKey: TITLE) { nodes { ${PRODUCT_FIELDS} } } }`, {}, buyerIp);
  if (!products.length && getStorefrontMode() === "preview") return previewProducts;
  return products;
}

export async function getCollectionProducts(handle: string, buyerIp?: string | null): Promise<BeejProduct[]> {
  const products = await queryProducts(
    `query BeejCollection($handle: String!) { collection(handle: $handle) { products(first: 20) { nodes { ${PRODUCT_FIELDS} } } } }`,
    { handle },
    buyerIp,
  );
  if (!products.length && getStorefrontMode() === "preview") {
    return previewProducts.filter((product) => product.collectionHandles.includes(handle));
  }
  return products;
}

export async function getProduct(handle: string, buyerIp?: string | null): Promise<BeejProduct | null> {
  try {
    const data = await storefrontQuery<{ productByHandle: ShopifyProductRaw | null }>(
      `query BeejProduct($handle: String!) { productByHandle(handle: $handle) { ${PRODUCT_FIELDS} } }`,
      { handle },
      buyerIp,
    );
    return data.productByHandle ? mapProduct(data.productByHandle) : getStorefrontMode() === "preview" ? previewProducts.find((product) => product.handle === handle) || null : null;
  } catch (error) {
    if (getStorefrontMode() === "preview") return previewProducts.find((product) => product.handle === handle) || null;
    throw error;
  }
}

export async function getSiteSettings(buyerIp?: string | null): Promise<SiteSettings> {
  try {
    const data = await storefrontQuery<{ shop: { storefrontSettings?: { value: string } | null } }>(
      `query BeejSettings { shop { storefrontSettings: metafield(namespace: "beej", key: "storefront_settings") { value } } }`,
      {},
      buyerIp,
    );
    const parsed = JSON.parse(data.shop.storefrontSettings?.value || "{}") as Record<string, unknown>;
    const settings: SiteSettings = {};
    const homeCopy = parseHomeCopy(parsed.homeCopy);
    if (homeCopy) settings.homeCopy = homeCopy;
    if (typeof parsed.announcement === "string") settings.announcement = parsed.announcement.slice(0, 160);
    if (typeof parsed.contactEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.contactEmail)) settings.contactEmail = parsed.contactEmail;
    if (typeof parsed.instagramUrl === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(parsed.instagramUrl)) settings.instagramUrl = parsed.instagramUrl;
    if (typeof parsed.whatsappUrl === "string" && /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(parsed.whatsappUrl)) settings.whatsappUrl = parsed.whatsappUrl;
    if (Array.isArray(parsed.featuredHandles)) settings.featuredHandles = parsed.featuredHandles.filter((handle): handle is string => typeof handle === "string").slice(0, 20);
    if (Array.isArray(parsed.slides)) settings.slides = parsed.slides.flatMap((slide) => {
      if (!slide || typeof slide !== "object") return [];
      const item = slide as Record<string, unknown>;
      if (typeof item.image !== "string" || typeof item.alt !== "string") return [];
      const src = item.image.startsWith("/assets/") || item.image.startsWith("https://cdn.shopify.com/") ? item.image : "";
      return src ? [{ src, alt: item.alt.slice(0, 160) }] : [];
    }).slice(0, 8);
    return settings;
  } catch {
    return {};
  }
}

export type ShopifyPage = { title: string; body: string; bodySummary: string; seo?: { title?: string | null; description?: string | null } | null };

export async function getShopifyPage(handle: string, buyerIp?: string | null): Promise<ShopifyPage | null> {
  try {
    const data = await storefrontQuery<{ pageByHandle: ShopifyPage | null }>(
      `query BeejPage($handle: String!) { pageByHandle(handle: $handle) { title body bodySummary seo { title description } } }`,
      { handle },
      buyerIp,
    );
    return data.pageByHandle;
  } catch {
    return null;
  }
}

export type ShopifyPolicy = { title: string; body: string; url: string };
export async function getShopifyPolicy(key: "privacyPolicy" | "refundPolicy" | "termsOfService", buyerIp?: string | null): Promise<ShopifyPolicy | null> {
  try {
    const data = await storefrontQuery<{ shop: Record<string, ShopifyPolicy | null> }>(
      `query BeejPolicy { shop { ${key} { title body url } } }`,
      {},
      buyerIp,
    );
    return data.shop[key] || null;
  } catch {
    return null;
  }
}

const CART_FIELDS = `id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 20) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale quantityAvailable price { amount currencyCode } selectedOptions { name value } product { id title handle productType featuredImage { url altText } } } } } }`;

type ShopifyCartConnection = Omit<ShopifyCart, "lines"> & { lines: { nodes: CartLine[] } };
type ShopifyCartMutation = {
  cart: ShopifyCartConnection | null;
  userErrors: Array<{ message: string; code?: string | null }>;
  warnings: Array<{ message: string }>;
};

function normalizeShopifyCart(cart: ShopifyCartConnection | null): ShopifyCart | null {
  return cart ? { ...cart, lines: cart.lines.nodes } : null;
}

function normalizeCartMutation<T extends { cart: ShopifyCartConnection | null }>(mutation: T): Omit<T, "cart"> & { cart: ShopifyCart | null } {
  return { ...mutation, cart: normalizeShopifyCart(mutation.cart) };
}

export async function getShopifyCart(cartId: string, buyerIp?: string | null): Promise<ShopifyCart | null> {
  const safeId = readCartCookie(cartId);
  if (!safeId) return null;
  const data = await storefrontQuery<{ cart: ShopifyCartConnection | null }>(
    `query BeejCart($id: ID!) { cart(id: $id) { ${CART_FIELDS} } }`,
    { id: safeId },
    buyerIp,
  );
  return normalizeShopifyCart(data.cart);
}

export async function createShopifyCart(lines: Array<{ merchandiseId: string; quantity: number }>, buyerIp?: string | null) {
  const data = await storefrontQuery<{ cartCreate: ShopifyCartMutation }>(
    `mutation BeejCartCreate($input: CartInput!) { cartCreate(input: $input) { cart { ${CART_FIELDS} } userErrors { message code } warnings { message } } }`,
    { input: { lines } },
    buyerIp,
  );
  return { ...data, cartCreate: normalizeCartMutation(data.cartCreate) };
}

export async function addShopifyCartLines(cartId: string, lines: Array<{ merchandiseId: string; quantity: number }>, buyerIp?: string | null) {
  const data = await storefrontQuery<{ cartLinesAdd: ShopifyCartMutation }>(
    `mutation BeejCartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message code } warnings { message } } }`,
    { cartId, lines },
    buyerIp,
  );
  return { ...data, cartLinesAdd: normalizeCartMutation(data.cartLinesAdd) };
}

export async function updateShopifyCartLines(cartId: string, lines: Array<{ id: string; quantity: number }>, buyerIp?: string | null) {
  const data = await storefrontQuery<{ cartLinesUpdate: ShopifyCartMutation }>(
    `mutation BeejCartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ${CART_FIELDS} } userErrors { message code } warnings { message } } }`,
    { cartId, lines },
    buyerIp,
  );
  return { ...data, cartLinesUpdate: normalizeCartMutation(data.cartLinesUpdate) };
}

export async function removeShopifyCartLines(cartId: string, lineIds: string[], buyerIp?: string | null) {
  const data = await storefrontQuery<{ cartLinesRemove: ShopifyCartMutation }>(
    `mutation BeejCartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ${CART_FIELDS} } userErrors { message code } warnings { message } } }`,
    { cartId, lineIds },
    buyerIp,
  );
  return { ...data, cartLinesRemove: normalizeCartMutation(data.cartLinesRemove) };
}
