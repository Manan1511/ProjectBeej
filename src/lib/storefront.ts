import "server-only";
import { unstable_cache } from "next/cache";
import { readCartCookie } from "@/lib/commerce";
import type { BeejProduct, CartLine, ProductFaq, ProductReview, ShopifyCart, ShopifyCartSnapshot, SiteSettings } from "@/lib/types";
import { parseAboutCopy, parseAnnouncement, parseFooterCopy, parseHomeCopy, parseShopCopy, parseSiteVisibility, parseStorefrontSlides } from "@/lib/storefront-settings";
import type { ConsentPreferences } from "@/lib/tracking-types";
import type { CartTargetOperations } from "@/lib/cart-actions";

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
  id handle title description descriptionHtml productType vendor seo { title description } updatedAt availableForSale tags
  featuredImage { url altText }
  images(first: 10) { nodes { url altText } }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 50) { nodes { id title sku barcode compareAtPrice { amount currencyCode } availableForSale price { amount currencyCode } selectedOptions { name value } } }
  collections(first: 10) { nodes { handle } }
  beejFaqs: metafield(namespace: "beej", key: "faqs") { value }
  beejApprovedReviews: metafield(namespace: "beej", key: "approved_reviews") { value }
`;

const PRODUCT_CARD_FIELDS = `
  id handle title description productType vendor availableForSale
  featuredImage { url altText }
  images(first: 2) { nodes { url altText } }
  priceRange { minVariantPrice { amount currencyCode } }
  variants(first: 50) { nodes { id title availableForSale price { amount currencyCode } selectedOptions { name value } } }
`;

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

function endpoint(api = "storefront") {
  if (!/^[-a-z0-9]+\.myshopify\.com$/i.test(domain)) throw new Error("SHOPIFY_STORE_DOMAIN must be a Shopify myshopify.com domain.");
  if (!/^\d{4}-\d{2}$/.test(API_VERSION)) throw new Error("SHOPIFY_API_VERSION must use YYYY-MM format.");
  return `https://${domain}/${api === "admin" ? "admin/api" : "api"}/${API_VERSION}/graphql.json`;
}

export function getStorefrontMode(): "preview" | "live" {
  return process.env.SHOPIFY_MODE === "live" ? "live" : "preview";
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
  timeoutMs = 12000,
): Promise<T> {
  const startedAt = performance.now();
  const measureName = `beej:shopify:${/^\s*mutation\b/i.test(query) ? "mutation" : "read"}`;
  try {
    const token = storefrontToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      [token.isPrivate ? "Shopify-Storefront-Private-Token" : "X-Shopify-Storefront-Access-Token"]: token.value,
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
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Shopify Storefront API returned ${response.status}.`);
    const payload = (await response.json()) as GraphqlResponse<T>;
    if (payload.errors?.length) throw new Error(payload.errors[0]?.message || "Shopify Storefront API request failed.");
    if (!payload.data) throw new Error("Shopify Storefront API returned no data.");
    return payload.data;
  } finally {
    performance.clearMeasures(measureName);
    performance.measure(measureName, { start: startedAt, end: performance.now() });
  }
}

/** Caches only successful public GraphQL results. Shopper-specific cart and checkout reads bypass this wrapper. */
async function publicStorefrontQuery<T, Result = T>(
  query: string,
  variables: Record<string, unknown> = {},
  validate: (data: T) => Result = ((data: T) => data as unknown as Result),
  tags: string[] = [],
): Promise<Result> {
  const cachedQuery = unstable_cache(
    async () => validate(await storefrontQuery<T>(query, variables)),
    ["project-beej-public-storefront", domain, API_VERSION, getStorefrontMode(), query, JSON.stringify(variables)],
    { revalidate: 60, ...(tags.length ? { tags } : {}) },
  );
  return cachedQuery();
}

type ShopifyProductRaw = {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml?: string;
  productType?: string;
  vendor?: string;
  seo?: { title?: string | null; description?: string | null } | null;
  updatedAt?: string;
  availableForSale: boolean;
  featuredImage?: { url: string; altText?: string | null } | null;
  images?: { nodes: Array<{ url: string; altText?: string | null }> };
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  variants: { nodes: Array<{ id: string; title: string; sku?: string | null; barcode?: string | null; compareAtPrice?: { amount: string; currencyCode: string } | null; availableForSale: boolean; quantityAvailable?: number | null; price: { amount: string; currencyCode: string }; selectedOptions: Array<{ name: string; value: string }> }> };
  collections?: { nodes: Array<{ handle: string }> };
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
  if (!raw || typeof raw.id !== "string" || typeof raw.handle !== "string" || typeof raw.title !== "string" || typeof raw.description !== "string"
    || !raw.priceRange?.minVariantPrice || typeof raw.priceRange.minVariantPrice.amount !== "string"
    || !Array.isArray(raw.variants?.nodes)) {
    throw new Error("Shopify returned incomplete product data.");
  }
  const images = (raw.images?.nodes || []).map((image) => ({ url: image.url, alt: image.altText || raw.title }));
  if (images.length === 0 && raw.featuredImage) images.push({ url: raw.featuredImage.url, alt: raw.featuredImage.altText || raw.title });
  return {
    id: raw.id,
    handle: raw.handle,
    title: raw.title,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    vendor: raw.vendor,
    seo: raw.seo,
    updatedAt: raw.updatedAt,
    productType: raw.productType || "Roasted Makhana",
    images,
    variants: raw.variants.nodes.map((variant) => ({ ...variant, selectedOptions: variant.selectedOptions || [] })),
    price: raw.priceRange.minVariantPrice,
    availableForSale: raw.availableForSale,
    collectionHandles: raw.collections?.nodes.map((collection) => collection.handle) || [],
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

async function queryProducts(query: string, variables: Record<string, unknown> = {}): Promise<BeejProduct[]> {
  try {
    return await publicStorefrontQuery<{
      products?: { nodes: ShopifyProductRaw[] };
      collection?: { products: { nodes: ShopifyProductRaw[] } | null } | null;
    }, BeejProduct[]>(query, variables, (data) => {
      const nodes = data.collection === null ? [] : data.collection?.products?.nodes ?? data.products?.nodes;
      if (!Array.isArray(nodes)) throw new Error("Shopify returned incomplete catalog data.");
      return nodes.map(mapProduct);
    });
  } catch (error) {
    if (getStorefrontMode() === "preview") return [];
    throw error;
  }
}

export async function getProducts(): Promise<BeejProduct[]> {
  const products = await queryProducts(`query BeejProducts { products(first: 20, sortKey: TITLE) { nodes { ${PRODUCT_FIELDS} } } }`);
  if (!products.length && getStorefrontMode() === "preview") return previewProducts;
  return products;
}

export async function getCardProducts(): Promise<BeejProduct[]> {
  const products = await queryProducts(`query BeejProductCards { products(first: 20, sortKey: TITLE) { nodes { ${PRODUCT_CARD_FIELDS} } } }`);
  if (!products.length && getStorefrontMode() === "preview") return previewProducts;
  return products;
}

/** Shares validated public collection data across pages and metadata generation. */
export async function getCollectionProducts(handle: string): Promise<BeejProduct[]> {
  const products = await queryProducts(
    `query BeejCollection($handle: String!) { collection(handle: $handle) { products(first: 20) { nodes { ${PRODUCT_FIELDS} } } } }`,
    { handle },
  );
  if (!products.length && getStorefrontMode() === "preview") {
    return previewProducts.filter((product) => product.collectionHandles.includes(handle));
  }
  return products;
}

export async function getCardCollectionProducts(handle: string): Promise<BeejProduct[]> {
  const products = await queryProducts(
    `query BeejCollectionCards($handle: String!) { collection(handle: $handle) { products(first: 20) { nodes { ${PRODUCT_CARD_FIELDS} } } } }`,
    { handle },
  );
  if (!products.length && getStorefrontMode() === "preview") {
    return previewProducts.filter((product) => product.collectionHandles.includes(handle));
  }
  return products;
}

export async function getProduct(handle: string): Promise<BeejProduct | null> {
  try {
    return await publicStorefrontQuery<{ productByHandle: ShopifyProductRaw | null }, BeejProduct | null>(
      `query BeejProduct($handle: String!) { productByHandle(handle: $handle) { ${PRODUCT_FIELDS} } }`,
      { handle },
      (data) => data.productByHandle ? mapProduct(data.productByHandle) : null,
    );
  } catch (error) {
    if (getStorefrontMode() === "preview") return previewProducts.find((product) => product.handle === handle) || null;
    throw error;
  }
}

export function getRequestCachedProduct(handle: string): Promise<BeejProduct | null> { return getProduct(handle); }

function mapSiteSettings(data: { shop?: { id?: string; paymentSettings?: { currencyCode?: string }; storefrontSettings?: { value: string } | null } }): SiteSettings {
  if (!data.shop || typeof data.shop !== "object") throw new Error("Shopify returned incomplete storefront settings.");
  let parsed: Record<string, unknown> = {};
  try {
    const value = JSON.parse(data.shop.storefrontSettings?.value || "{}") as unknown;
    if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
  } catch { /* Invalid optional settings are ignored. */ }
  const settings: SiteSettings = {
    ...(data.shop.id && /^gid:\/\/shopify\/Shop\/\d+$/.test(data.shop.id) ? { shopId: data.shop.id } : {}),
    ...(data.shop.paymentSettings?.currencyCode && /^[A-Z]{3}$/.test(data.shop.paymentSettings.currencyCode) ? { currencyCode: data.shop.paymentSettings.currencyCode } : {}),
  };
  const homeCopy = parseHomeCopy(parsed.homeCopy);
  if (homeCopy) settings.homeCopy = homeCopy;
  const shopCopy = parseShopCopy(parsed.shopCopy);
  if (shopCopy) settings.shopCopy = shopCopy;
  const aboutCopy = parseAboutCopy(parsed.aboutCopy);
  if (aboutCopy) settings.aboutCopy = aboutCopy;
  const footerCopy = parseFooterCopy(parsed.footerCopy);
  if (footerCopy) settings.footerCopy = footerCopy;
  const visibility = parseSiteVisibility(parsed.visibility);
  if (visibility) settings.visibility = visibility;
  if (parsed.contentVersion === 1) settings.contentVersion = 1;
  const announcement = parseAnnouncement(parsed.announcement);
  if (announcement) settings.announcement = announcement;
  if (typeof parsed.contactEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parsed.contactEmail)) settings.contactEmail = parsed.contactEmail;
  if (typeof parsed.instagramUrl === "string" && /^https:\/\/(www\.)?instagram\.com\//.test(parsed.instagramUrl)) settings.instagramUrl = parsed.instagramUrl;
  if (typeof parsed.whatsappUrl === "string" && /^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(parsed.whatsappUrl)) settings.whatsappUrl = parsed.whatsappUrl;
  if (Array.isArray(parsed.featuredHandles)) settings.featuredHandles = parsed.featuredHandles.filter((handle): handle is string => typeof handle === "string").slice(0, 20);
  if (Array.isArray(parsed.slides)) settings.slides = parseStorefrontSlides(parsed.slides);
  return settings;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    return await publicStorefrontQuery<{ shop?: { id?: string; paymentSettings?: { currencyCode?: string }; storefrontSettings?: { value: string } | null } }, SiteSettings>(
      `query BeejSettings { shop { id paymentSettings { currencyCode } storefrontSettings: metafield(namespace: "beej", key: "storefront_settings") { value } } }`,
    {},
      mapSiteSettings,
      ["storefront-settings"],
    );
  } catch {
    if (getStorefrontMode() === "preview") return {};
    throw new Error("Storefront settings could not be loaded. Try again.");
  }
}

export function getRequestCachedSiteSettings(): Promise<SiteSettings> { return getSiteSettings(); }

export type ShopifyPage = { title: string; body: string; bodySummary: string; seo?: { title?: string | null; description?: string | null } | null };

export async function getShopifyPage(handle: string): Promise<ShopifyPage | null> {
  return await publicStorefrontQuery<{ pageByHandle: ShopifyPage | null }, ShopifyPage | null>(
      `query BeejPage($handle: String!) { pageByHandle(handle: $handle) { title body bodySummary seo { title description } } }`,
      { handle },
      (data) => {
        const page = data.pageByHandle;
        if (page === null) return null;
        if (!page || typeof page.title !== "string" || typeof page.body !== "string" || typeof page.bodySummary !== "string") throw new Error("Shopify returned incomplete page data.");
        return page;
      },
    );
}

export type ShopifyPolicy = { title: string; body: string; url: string };
export async function getShopifyPolicy(key: "privacyPolicy" | "refundPolicy" | "termsOfService"): Promise<ShopifyPolicy | null> {
  return await publicStorefrontQuery<{ shop?: Record<string, ShopifyPolicy | null> }, ShopifyPolicy | null>(
      `query BeejPolicy { shop { ${key} { title body url } } }`,
      {},
      (data) => {
        if (!data.shop || typeof data.shop !== "object") throw new Error("Shopify returned incomplete policy data.");
        const policy = data.shop[key];
        if (policy === null || policy === undefined) return null;
        if (typeof policy.title !== "string" || typeof policy.body !== "string" || typeof policy.url !== "string") throw new Error("Shopify returned incomplete policy data.");
        return policy;
      },
    );
}

const CART_FIELDS = `id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } lines(first: 20) { nodes { id quantity merchandise { ... on ProductVariant { id title availableForSale price { amount currencyCode } selectedOptions { name value } product { id title handle productType featuredImage { url altText } } } } } }`;
const CART_SNAPSHOT_FIELDS = `totalQuantity lines(first: 20) { nodes { id quantity merchandise { ... on ProductVariant { id } } } }`;

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

/** Lightweight preflight for cart writes; it avoids downloading prices and product images. */
export async function getShopifyCartSnapshot(cartId: string, buyerIp?: string | null): Promise<ShopifyCartSnapshot | null> {
  const safeId = readCartCookie(cartId);
  if (!safeId) return null;
  const data = await storefrontQuery<{ cart: (Omit<ShopifyCartSnapshot, "lines"> & { lines: { nodes: ShopifyCartSnapshot["lines"] } }) | null }>(
    `query BeejCartSnapshot($id: ID!) { cart(id: $id) { ${CART_SNAPSHOT_FIELDS} } }`,
    { id: safeId },
    buyerIp,
  );
  return data.cart ? { totalQuantity: data.cart.totalQuantity, lines: data.cart.lines.nodes } : null;
}

export async function getShopifyCartCount(cartId: string, buyerIp?: string | null): Promise<number> {
  const safeId = readCartCookie(cartId);
  if (!safeId) return 0;
  const data = await storefrontQuery<{ cart: { totalQuantity: number } | null }>(
    `query BeejCartCount($id: ID!) { cart(id: $id) { totalQuantity } }`,
    { id: safeId },
    buyerIp,
  );
  return data.cart?.totalQuantity || 0;
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

/** Runs all non-empty line operations in a single serial GraphQL mutation request. */
export async function applyShopifyCartLineTargets(cartId: string, operations: CartTargetOperations, buyerIp?: string | null) {
  const definitions = ["$cartId: ID!"];
  const fields: string[] = [];
  const aliases: string[] = [];
  const variables: Record<string, unknown> = { cartId };
  const selection = `{ cart { ${CART_FIELDS} } userErrors { message code } warnings { message } }`;

  if (operations.updates.length) {
    definitions.push("$updates: [CartLineUpdateInput!]!");
    variables.updates = operations.updates;
    fields.push(`updated: cartLinesUpdate(cartId: $cartId, lines: $updates) ${selection}`);
    aliases.push("updated");
  }
  if (operations.removals.length) {
    definitions.push("$lineIds: [ID!]!");
    variables.lineIds = operations.removals;
    fields.push(`removed: cartLinesRemove(cartId: $cartId, lineIds: $lineIds) ${selection}`);
    aliases.push("removed");
  }
  if (operations.additions.length) {
    definitions.push("$additions: [CartLineInput!]!");
    variables.additions = operations.additions;
    fields.push(`added: cartLinesAdd(cartId: $cartId, lines: $additions) ${selection}`);
    aliases.push("added");
  }
  if (fields.length === 0) throw new Error("A cart update must include at least one changed line.");

  const query = `mutation BeejCartTargets(${definitions.join(", ")}) { ${fields.join(" ")} }`;
  const data = await storefrontQuery<Record<string, ShopifyCartMutation | null>>(query, variables, buyerIp);
  const mutations = aliases.map((alias) => data[alias]).filter((value): value is ShopifyCartMutation => Boolean(value));
  const last = mutations.at(-1);
  return {
    cart: normalizeShopifyCart(last?.cart || null),
    userErrors: mutations.flatMap((mutation) => mutation.userErrors),
    warnings: mutations.flatMap((mutation) => mutation.warnings),
  };
}

export type ShopifyCartAttribute = { key: string; value: string };

export async function getShopifyCartAttributes(cartId: string, buyerIp?: string | null, timeoutMs = 12000): Promise<ShopifyCartAttribute[]> {
  const safeId = readCartCookie(cartId);
  if (!safeId) return [];
  const data = await storefrontQuery<{ cart: { attributes: ShopifyCartAttribute[] } | null }>(
    `query BeejCartAttributes($id: ID!) { cart(id: $id) { attributes { key value } } }`,
    { id: safeId },
    buyerIp,
    timeoutMs,
  );
  return data.cart?.attributes || [];
}

export async function updateShopifyCartAttributes(cartId: string, attributes: ShopifyCartAttribute[], buyerIp?: string | null, timeoutMs = 12000) {
  const safeId = readCartCookie(cartId);
  if (!safeId) throw new Error("Invalid Shopify cart ID.");
  const data = await storefrontQuery<{ cartAttributesUpdate: { userErrors: Array<{ message: string; code?: string | null }>; warnings: Array<{ message: string }> } }>(
    `mutation BeejCartAttributesUpdate($cartId: ID!, $attributes: [AttributeInput!]!) { cartAttributesUpdate(cartId: $cartId, attributes: $attributes) { userErrors { message code } warnings { message } } }`,
    { cartId: safeId, attributes },
    buyerIp,
    timeoutMs,
  );
  return data.cartAttributesUpdate;
}

export async function getFreshShopifyCheckoutUrl(cartId: string, consent: ConsentPreferences, buyerIp?: string | null): Promise<string | null> {
  const safeId = readCartCookie(cartId);
  if (!safeId) return null;
  const data = await storefrontQuery<{ cart: { checkoutUrl: string } | null }>(
    `query BeejFreshCheckout($id: ID!, $analytics: Boolean!, $marketing: Boolean!, $preferences: Boolean!) @inContext(visitorConsent: { analytics: $analytics, marketing: $marketing, preferences: $preferences, saleOfData: false }) { cart(id: $id) { checkoutUrl } }`,
    { id: safeId, analytics: consent.analytics, marketing: consent.marketing, preferences: consent.preferences },
    buyerIp,
  );
  return data.cart?.checkoutUrl || null;
}

export type ShopifyCheckoutAddress = {
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  province: string;
  provinceCode?: string;
  countryCode: "IN";
  zip: string;
  phone: string;
};

export type ShopifyDeliveryOption = {
  handle: string;
  title: string;
  description: string | null;
  amount: string;
  currencyCode: string;
};

export type ShopifyDeliveryGroup = {
  id: string;
  options: ShopifyDeliveryOption[];
};

export type ShopifyDeliveryCartQuote = {
  cartId: string;
  totalQuantity: number;
  subtotal: { amount: string; currencyCode: string };
  total: { amount: string; currencyCode: string };
  groups: ShopifyDeliveryGroup[];
};

const DELIVERY_GROUP_FIELDS = `deliveryGroups(first: 10) { nodes { id deliveryOptions { handle title description estimatedCost { amount currencyCode } } } }`;

function throwDeliveryErrors(errors: Array<{ message?: string }> | null | undefined, fallback: string): void {
  if (errors?.length) throw new Error(errors[0]?.message || fallback);
}

function normalizeDeliveryQuote(cart: {
  id: string;
  totalQuantity: number;
  cost: { subtotalAmount: { amount: string; currencyCode: string }; totalAmount: { amount: string; currencyCode: string } };
  deliveryGroups: { nodes: Array<{ id: string; deliveryOptions: Array<{ handle: string; title: string | null; description: string | null; estimatedCost: { amount: string; currencyCode: string } }> }> };
} | null): ShopifyDeliveryCartQuote {
  if (!cart) throw new Error("Your bag expired. Add your snacks again to continue.");
  const groups = cart.deliveryGroups.nodes.map((group) => ({
    id: group.id,
    options: group.deliveryOptions.map((option) => ({
      handle: option.handle,
      title: option.title || "Delivery",
      description: option.description,
      amount: option.estimatedCost.amount,
      currencyCode: option.estimatedCost.currencyCode,
    })),
  }));
  if (!groups.length || groups.some((group) => group.options.length === 0)) throw new Error("No delivery methods are available for this address.");
  return {
    cartId: cart.id,
    totalQuantity: cart.totalQuantity,
    subtotal: cart.cost.subtotalAmount,
    total: cart.cost.totalAmount,
    groups,
  };
}

/** Assigns the buyer's one-time shipping address and reads Shopify's current delivery options. */
export async function getShopifyDeliveryOptions(
  cartId: string,
  address: ShopifyCheckoutAddress,
  buyerIp?: string | null,
): Promise<ShopifyDeliveryCartQuote> {
  const safeId = readCartCookie(cartId);
  if (!safeId) throw new Error("Invalid Shopify cart ID.");

  const addressQuery = `query BeejCartDeliveryAddresses($id: ID!) { cart(id: $id) { delivery { addresses { id selected } } } }`;
  const current = await storefrontQuery<{ cart: { delivery: { addresses: Array<{ id: string; selected: boolean }> } } | null }>(addressQuery, { id: safeId }, buyerIp);
  if (!current.cart) throw new Error("Your bag expired. Add your snacks again to continue.");

  const selected = current.cart.delivery.addresses.find((item) => item.selected) || current.cart.delivery.addresses[0];
  if (selected) {
    const update = await storefrontQuery<{ cartDeliveryAddressesUpdate: { userErrors: Array<{ message: string }> } }>(
      `mutation BeejUpdateCartDeliveryAddress($cartId: ID!, $addresses: [CartSelectableAddressUpdateInput!]!) { cartDeliveryAddressesUpdate(cartId: $cartId, addresses: $addresses) { userErrors { message } } }`,
      { cartId: safeId, addresses: [{ id: selected.id, address: { deliveryAddress: address }, selected: true, oneTimeUse: true }] },
      buyerIp,
    );
    throwDeliveryErrors(update.cartDeliveryAddressesUpdate.userErrors, "Shopify could not validate this delivery address.");
  } else {
    const add = await storefrontQuery<{ cartDeliveryAddressesAdd: { userErrors: Array<{ message: string }> } }>(
      `mutation BeejAddCartDeliveryAddress($cartId: ID!, $addresses: [CartSelectableAddressInput!]!) { cartDeliveryAddressesAdd(cartId: $cartId, addresses: $addresses) { userErrors { message } } }`,
      { cartId: safeId, addresses: [{ address: { deliveryAddress: address }, selected: true, oneTimeUse: true }] },
      buyerIp,
    );
    throwDeliveryErrors(add.cartDeliveryAddressesAdd.userErrors, "Shopify could not validate this delivery address.");
  }

  const result = await storefrontQuery<{ cart: Parameters<typeof normalizeDeliveryQuote>[0] }>(
    `query BeejCartDeliveryOptions($id: ID!) { cart(id: $id) { id totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } ${DELIVERY_GROUP_FIELDS} } }`,
    { id: safeId },
    buyerIp,
  );
  return normalizeDeliveryQuote(result.cart);
}

/** Selects only handles returned for the same cart and returns Shopify's updated total. */
export async function selectShopifyDeliveryOptions(
  cartId: string,
  selections: Array<{ deliveryGroupId: string; deliveryOptionHandle: string }>,
  buyerIp?: string | null,
): Promise<ShopifyDeliveryCartQuote> {
  const safeId = readCartCookie(cartId);
  if (!safeId || !selections.length || selections.length > 10) throw new Error("Choose a delivery method to continue.");

  const current = await storefrontQuery<{ cart: Parameters<typeof normalizeDeliveryQuote>[0] }>(
    `query BeejCheckDeliveryOptions($id: ID!) { cart(id: $id) { id totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } ${DELIVERY_GROUP_FIELDS} } }`,
    { id: safeId },
    buyerIp,
  );
  const quote = normalizeDeliveryQuote(current.cart);
  if (quote.groups.length !== selections.length) throw new Error("Delivery choices changed. Refresh the available methods and try again.");
  const groups = new Map(quote.groups.map((group) => [group.id, group]));
  const seen = new Set<string>();
  for (const selection of selections) {
    const group = groups.get(selection.deliveryGroupId);
    if (!group || seen.has(selection.deliveryGroupId) || !group.options.some((option) => option.handle === selection.deliveryOptionHandle)) {
      throw new Error("A selected delivery method is no longer available. Refresh the available methods and try again.");
    }
    seen.add(selection.deliveryGroupId);
  }

  const update = await storefrontQuery<{ cartSelectedDeliveryOptionsUpdate: { userErrors: Array<{ message: string }>; cart: Parameters<typeof normalizeDeliveryQuote>[0] } }>(
    `mutation BeejSelectDeliveryOptions($cartId: ID!, $selectedDeliveryOptions: [CartSelectedDeliveryOptionInput!]!) { cartSelectedDeliveryOptionsUpdate(cartId: $cartId, selectedDeliveryOptions: $selectedDeliveryOptions) { userErrors { message } cart { id totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } } ${DELIVERY_GROUP_FIELDS} } } }`,
    { cartId: safeId, selectedDeliveryOptions: selections },
    buyerIp,
  );
  throwDeliveryErrors(update.cartSelectedDeliveryOptionsUpdate.userErrors, "Shopify could not select this delivery method.");
  return normalizeDeliveryQuote(update.cartSelectedDeliveryOptionsUpdate.cart);
}
