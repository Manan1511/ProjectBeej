import "server-only";
import { cashfreeAmountMatches } from "@/lib/cashfree-core";
import { getShopifyAdminAccessToken, getShopifyAdminStoreDomain } from "@/lib/shopify-admin-auth";
import type { ShopifyCart } from "@/lib/types";
import type { ShopifyCheckoutAddress, ShopifyDeliveryCartQuote, ShopifyDeliveryOption } from "@/lib/storefront";

type ShopifyGraphqlError = { message?: string };
type ShopifyResponse<T> = { data?: T; errors?: ShopifyGraphqlError[] };
type Money = { amount: string; currencyCode: string };
type MoneyBag = { shopMoney: Money; presentmentMoney: Money };
type ShopifyTaxLine = { title: string; rate: number | null; priceSet: MoneyBag; channelLiable?: boolean | null };

export type CashfreeCheckoutBuyer = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type CashfreeDraftState = {
  version: 1;
  status: "awaiting_payment" | "processing" | "paid";
  orderId: string;
  source: "bag" | "buy-now";
  createdAt: string;
  updatedAt: string;
  paymentId?: string;
  shopifyOrderId?: string;
};

export type CashfreeDraftLine = {
  quantity: number;
  title: string;
  sku: string | null;
  variantId: string | null;
  taxable: boolean;
  requiresShipping: boolean;
  originalUnitPriceSet: MoneyBag;
  discountedTotalSet: MoneyBag;
  taxLines: ShopifyTaxLine[];
};

export type CashfreeDraftQuote = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  orderId: string;
  currencyCode: string;
  presentmentCurrencyCode: string;
  totalPriceSet: MoneyBag;
  totalShippingPriceSet: MoneyBag;
  totalTaxSet: MoneyBag;
  totalDiscountsSet: MoneyBag;
  taxesIncluded: boolean;
  shippingAddress: {
    firstName: string | null;
    lastName: string | null;
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    provinceCode: string | null;
    countryCodeV2: string | null;
    zip: string | null;
    phone: string | null;
  } | null;
  shippingLine: {
    title: string;
    discountedPriceSet: MoneyBag;
    taxLines: ShopifyTaxLine[];
  } | null;
  appliedDiscountAmountSet: MoneyBag | null;
  lineItems: CashfreeDraftLine[];
  state: { value: string; compareDigest: string } | null;
  createdAt: string;
  updatedAt: string;
};

export class ShopifyCashfreeError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "ShopifyCashfreeError";
  }
}

function apiVersion(): string {
  const version = process.env.SHOPIFY_API_VERSION || "2026-10";
  if (!/^\d{4}-\d{2}$/.test(version)) throw new ShopifyCashfreeError("Shopify Admin API version is invalid.", 503);
  return version;
}

async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const domain = getShopifyAdminStoreDomain();
  const token = await getShopifyAdminAccessToken();
  let response: Response;
  try {
    response = await fetch(`https://${domain}/admin/api/${apiVersion()}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ShopifyCashfreeError("Shopify Admin did not return a response.");
  }
  if (!response.ok) throw new ShopifyCashfreeError("Shopify Admin is temporarily unavailable.");
  let payload: ShopifyResponse<T>;
  try {
    payload = await response.json() as ShopifyResponse<T>;
  } catch {
    throw new ShopifyCashfreeError("Shopify Admin returned an invalid response.");
  }
  if (payload.errors?.length || !payload.data) throw new ShopifyCashfreeError("Shopify Admin could not process this checkout.");
  return payload.data;
}

function amount(value: unknown): number {
  const parsed = typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function selectedShipping(
  quote: ShopifyDeliveryCartQuote,
  selections: Array<{ deliveryGroupId: string; deliveryOptionHandle: string }>,
): { title: string; amount: number; currencyCode: string } {
  if (quote.groups.length !== selections.length) throw new ShopifyCashfreeError("Delivery choices changed. Refresh and choose a delivery method again.", 409);
  const chosen: ShopifyDeliveryOption[] = [];
  const groupMap = new Map(quote.groups.map((group) => [group.id, group]));
  const seen = new Set<string>();
  for (const selection of selections) {
    const group = groupMap.get(selection.deliveryGroupId);
    const option = group?.options.find((item) => item.handle === selection.deliveryOptionHandle);
    if (!group || !option || seen.has(group.id)) throw new ShopifyCashfreeError("A delivery method is no longer available. Refresh and try again.", 409);
    seen.add(group.id);
    chosen.push(option);
  }
  const currencyCode = chosen[0]?.currencyCode;
  if (!currencyCode || chosen.some((option) => option.currencyCode !== currencyCode)) throw new ShopifyCashfreeError("Shopify returned inconsistent delivery currencies.");
  return {
    title: chosen.map((option) => option.title).join(" + ").slice(0, 255),
    amount: chosen.reduce((sum, option) => sum + amount(option.amount), 0),
    currencyCode,
  };
}

const CREATE_DRAFT = `mutation BeejCashfreeDraft($input: DraftOrderInput!) {
  draftOrderCreate(input: $input) {
    draftOrder { id name ready currencyCode presentmentCurrencyCode totalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } }
    userErrors { field message }
  }
}`;

export async function createCashfreeDraftQuote(input: {
  cart: ShopifyCart;
  deliveryQuote: ShopifyDeliveryCartQuote;
  deliverySelections: Array<{ deliveryGroupId: string; deliveryOptionHandle: string }>;
  address: ShopifyCheckoutAddress;
  buyer: CashfreeCheckoutBuyer;
  orderId: string;
  source: "bag" | "buy-now";
}): Promise<{ id: string; amount: number; currencyCode: string; name: string }> {
  if (input.cart.totalQuantity < 1 || input.cart.lines.length < 1 || input.cart.lines.length > 20) {
    throw new ShopifyCashfreeError("Your bag is empty or could not be read.", 409);
  }
  if (input.deliveryQuote.cartId !== input.cart.id || input.deliveryQuote.totalQuantity !== input.cart.totalQuantity) {
    throw new ShopifyCashfreeError("Your bag changed. Refresh checkout before paying.", 409);
  }
  const shipping = selectedShipping(input.deliveryQuote, input.deliverySelections);
  if (shipping.currencyCode !== "INR" || input.deliveryQuote.total.currencyCode !== "INR" || input.cart.cost.totalAmount.currencyCode !== "INR") {
    throw new ShopifyCashfreeError("Cashfree sandbox checkout supports INR orders only.", 422);
  }
  const quoteState: CashfreeDraftState = {
    version: 1,
    status: "awaiting_payment",
    orderId: input.orderId,
    source: input.source,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const address = {
    firstName: input.address.firstName,
    lastName: input.address.lastName,
    address1: input.address.address1,
    ...(input.address.address2 ? { address2: input.address.address2 } : {}),
    city: input.address.city,
    province: input.address.province,
    ...(input.address.provinceCode ? { provinceCode: input.address.provinceCode } : {}),
    countryCode: "IN",
    zip: input.address.zip,
    phone: input.address.phone || input.buyer.phone,
  };

  const data = await adminGraphql<{
    draftOrderCreate?: {
      draftOrder?: { id: string; name: string; ready: boolean; currencyCode: string; presentmentCurrencyCode: string; totalPriceSet: MoneyBag } | null;
      userErrors?: Array<{ message: string }>;
    } | null;
  }>(CREATE_DRAFT, {
    input: {
      email: input.buyer.email,
      phone: input.address.phone || input.buyer.phone,
      shippingAddress: address,
      billingAddress: address,
      presentmentCurrencyCode: "INR",
      acceptAutomaticDiscounts: true,
      allowDiscountCodesInCheckout: false,
      lineItems: input.cart.lines.map((line) => ({ variantId: line.merchandise.id, quantity: line.quantity })),
      shippingLine: {
        title: shipping.title || "Delivery",
        priceWithCurrency: { amount: shipping.amount.toFixed(2), currencyCode: shipping.currencyCode },
      },
      customAttributes: [
        { key: "beej_cashfree_order_id", value: input.orderId },
        { key: "beej_checkout_source", value: input.source },
      ],
      tags: ["beej-cashfree-sandbox"],
      metafields: [{ namespace: "beej", key: "cashfree_payment_state", type: "json", value: JSON.stringify(quoteState) }],
    },
  });
  const result = data.draftOrderCreate;
  const userErrors = result?.userErrors || [];
  if (userErrors.length) throw new ShopifyCashfreeError(userErrors[0]?.message || "Shopify could not calculate this order.", 422);
  const draft = result?.draftOrder;
  if (!draft?.id || !draft.ready) throw new ShopifyCashfreeError("Shopify has not finished calculating this order. Refresh and try again.", 409);

  const cartAmount = amount(input.deliveryQuote.total.amount);
  const draftAmount = amount(draft.totalPriceSet.presentmentMoney.amount);
  if (draft.presentmentCurrencyCode !== "INR" || draft.totalPriceSet.presentmentMoney.currencyCode !== "INR" || !cashfreeAmountMatches(cartAmount, draftAmount)) {
    throw new ShopifyCashfreeError("Shopify's final total did not match the cart estimate. Use Shopify checkout for this order.", 409);
  }
  if (!Number.isFinite(draftAmount) || draftAmount < 1 || draftAmount > 1_000_000) throw new ShopifyCashfreeError("This order amount is outside Cashfree sandbox limits.", 422);

  return { id: draft.id, amount: draftAmount, currencyCode: draft.totalPriceSet.presentmentMoney.currencyCode, name: draft.name };
}

export async function deleteCashfreeDraftQuote(id: string): Promise<void> {
  if (!id.startsWith("gid://shopify/DraftOrder/") || id.length > 200) return;
  const result = await adminGraphql<{ draftOrderDelete?: { userErrors?: Array<{ message: string }> } | null }>(
    `mutation BeejDeleteCashfreeDraft($id: ID!) { draftOrderDelete(input: { id: $id }) { userErrors { message } } }`,
    { id },
  );
  if (result.draftOrderDelete?.userErrors?.length) throw new ShopifyCashfreeError("Shopify could not clear the unused payment draft.");
}

const READ_DRAFT = `query BeejCashfreeDraft($id: ID!) {
  draftOrder(id: $id) {
    id name email phone currencyCode presentmentCurrencyCode createdAt updatedAt ready taxesIncluded
    totalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    totalShippingPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    totalTaxSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    totalDiscountsSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }
    appliedDiscount { amountSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } }
    shippingAddress { firstName lastName address1 address2 city province provinceCode countryCodeV2 zip phone }
    shippingLine { title discountedPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } taxLines { title rate priceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } channelLiable } }
    lineItems(first: 100) { nodes { quantity title sku taxable requiresShipping variant { id } originalUnitPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } discountedTotalSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } taxLines { title rate priceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } } channelLiable } } }
    customAttributes { key value }
    state: metafield(namespace: "beej", key: "cashfree_payment_state") { value compareDigest }
  }
}`;

export async function readCashfreeDraftQuote(id: string): Promise<CashfreeDraftQuote | null> {
  if (!id.startsWith("gid://shopify/DraftOrder/") || id.length > 200) return null;
  const data = await adminGraphql<{ draftOrder?: Omit<CashfreeDraftQuote, "orderId" | "lineItems" | "appliedDiscountAmountSet"> & {
    customAttributes?: Array<{ key: string; value: string }>;
    lineItems?: { nodes?: CashfreeDraftLine[] };
    appliedDiscount?: { amountSet?: MoneyBag | null } | null;
  } | null }>(READ_DRAFT, { id });
  const draft = data.draftOrder;
  if (!draft) return null;
  const orderId = draft.state?.value ? parseCashfreeDraftState(draft.state.value)?.orderId : undefined;
  if (!orderId) return null;
  return { ...draft, orderId, lineItems: draft.lineItems?.nodes || [], appliedDiscountAmountSet: draft.appliedDiscount?.amountSet || null };
}

export function parseCashfreeDraftState(value: string): CashfreeDraftState | null {
  try {
    const state = JSON.parse(value) as Partial<CashfreeDraftState>;
    if (state.version !== 1 || typeof state.orderId !== "string" || !/^beej_[a-f0-9]{32}$/.test(state.orderId)
      || (state.source !== "bag" && state.source !== "buy-now")
      || !["awaiting_payment", "processing", "paid"].includes(String(state.status))
      || typeof state.createdAt !== "string" || typeof state.updatedAt !== "string") return null;
    return state as CashfreeDraftState;
  } catch {
    return null;
  }
}

function normalized(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-IN");
}

function sameMoney(a: Money, b: Money): boolean {
  return a.currencyCode === b.currencyCode && cashfreeAmountMatches(amount(a.amount), amount(b.amount));
}

function sameAddress(a: CashfreeDraftQuote["shippingAddress"], b: CashfreeDraftQuote["shippingAddress"]): boolean {
  if (!a || !b) return false;
  const keys = ["firstName", "lastName", "address1", "address2", "city", "province", "provinceCode", "countryCodeV2", "zip"] as const;
  return keys.every((key) => normalized(a[key]) === normalized(b[key]))
    && (a.phone || "").replace(/\D/g, "") === (b.phone || "").replace(/\D/g, "");
}

function draftLinesIdentity(draft: CashfreeDraftQuote): string {
  return JSON.stringify(draft.lineItems.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    taxable: line.taxable,
    requiresShipping: line.requiresShipping,
    discountedTotalSet: line.discountedTotalSet.presentmentMoney,
    taxLines: line.taxLines.map((tax) => ({ title: tax.title, rate: tax.rate, price: tax.priceSet.presentmentMoney })).sort((a, b) => a.title.localeCompare(b.title)),
  })).sort((a, b) => (a.variantId || "").localeCompare(b.variantId || "")));
}

/** Confirms that reusing an idempotent Cashfree order would charge for this exact checkout. */
export function cashfreeDraftMatchesCheckout(existing: CashfreeDraftQuote, current: CashfreeDraftQuote): boolean {
  if (existing.orderId !== current.orderId || !existing.state || !current.state) return false;
  const existingState = parseCashfreeDraftState(existing.state.value);
  const currentState = parseCashfreeDraftState(current.state.value);
  if (!existingState || !currentState || existingState.status !== "awaiting_payment" || currentState.status !== "awaiting_payment"
    || existingState.source !== currentState.source) return false;

  const zeroINR = { amount: "0", currencyCode: "INR" };
  if (normalized(existing.email) !== normalized(current.email)
    || (existing.phone || "").replace(/\D/g, "") !== (current.phone || "").replace(/\D/g, "")
    || !sameAddress(existing.shippingAddress, current.shippingAddress)
    || existing.currencyCode !== current.currencyCode
    || existing.presentmentCurrencyCode !== current.presentmentCurrencyCode
    || !sameMoney(existing.totalPriceSet.presentmentMoney, current.totalPriceSet.presentmentMoney)
    || !sameMoney(existing.totalShippingPriceSet.presentmentMoney, current.totalShippingPriceSet.presentmentMoney)
    || !sameMoney(existing.totalTaxSet.presentmentMoney, current.totalTaxSet.presentmentMoney)
    || !sameMoney(existing.totalDiscountsSet.presentmentMoney, current.totalDiscountsSet.presentmentMoney)
    || !sameMoney(existing.appliedDiscountAmountSet?.presentmentMoney || zeroINR, current.appliedDiscountAmountSet?.presentmentMoney || zeroINR)
    || normalized(existing.shippingLine?.title) !== normalized(current.shippingLine?.title)
    || !sameMoney(existing.shippingLine?.discountedPriceSet.presentmentMoney || zeroINR, current.shippingLine?.discountedPriceSet.presentmentMoney || zeroINR)
    || draftLinesIdentity(existing) !== draftLinesIdentity(current)) return false;
  return true;
}

export async function updateCashfreeDraftState(input: {
  draft: CashfreeDraftQuote;
  next: CashfreeDraftState;
}): Promise<boolean> {
  if (!input.draft.state?.compareDigest) return false;
  const mutation = `mutation BeejUpdateCashfreeDraftState($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id compareDigest } userErrors { code message } }
  }`;
  const data = await adminGraphql<{ metafieldsSet?: { metafields?: unknown[]; userErrors?: Array<{ code?: string | null; message: string }> } | null }>(mutation, {
    metafields: [{ ownerId: input.draft.id, namespace: "beej", key: "cashfree_payment_state", type: "json", value: JSON.stringify(input.next), compareDigest: input.draft.state.compareDigest }],
  });
  const result = data.metafieldsSet;
  if (result?.userErrors?.some((error) => error.code === "STALE_OBJECT" || /compare|stale/i.test(error.message))) return false;
  if (result?.userErrors?.length || result?.metafields?.length !== 1) throw new ShopifyCashfreeError("Shopify could not save the payment status.");
  return true;
}

export async function findCashfreeShopifyOrder(orderId: string): Promise<{ id: string; name: string } | null> {
  if (!/^beej_[a-f0-9]{32}$/.test(orderId)) return null;
  const data = await adminGraphql<{ orders?: { nodes?: Array<{ id: string; name: string }> } | null }>(
    `query BeejCashfreeOrder($query: String!) { orders(first: 1, query: $query) { nodes { id name } } }`,
    { query: `source_identifier:${orderId}` },
  );
  return data.orders?.nodes?.[0] || null;
}

function buildTestOrderInput(draft: CashfreeDraftQuote, orderId: string, paymentId: string) {
  if (draft.presentmentCurrencyCode !== "INR" || draft.currencyCode !== "INR" || draft.totalPriceSet.presentmentMoney.currencyCode !== "INR") {
    throw new ShopifyCashfreeError("The saved order is not an INR draft.", 409);
  }
  if (draft.lineItems.length < 1 || draft.lineItems.some((line) => !line.variantId || line.quantity < 1)) {
    throw new ShopifyCashfreeError("The saved draft contains an invalid product line.", 409);
  }
  const totalDiscount = draft.appliedDiscountAmountSet;
  const discountShop = totalDiscount ? amount(totalDiscount.shopMoney.amount) : 0;
  const discountPresentment = totalDiscount ? amount(totalDiscount.presentmentMoney.amount) : 0;
  const eligibleLines = draft.lineItems.map((line) => ({ line, shop: amount(line.discountedTotalSet.shopMoney.amount), presentment: amount(line.discountedTotalSet.presentmentMoney.amount) }));
  const shopBase = eligibleLines.reduce((sum, item) => sum + item.shop, 0);
  const presentmentBase = eligibleLines.reduce((sum, item) => sum + item.presentment, 0);
  if ([shopBase, presentmentBase, discountShop, discountPresentment].some((value) => !Number.isFinite(value))
    || discountShop > shopBase || discountPresentment > presentmentBase) {
    throw new ShopifyCashfreeError("The saved discount could not be reconciled to order lines.", 409);
  }

  let allocatedShop = 0;
  let allocatedPresentment = 0;
  const lineItems = eligibleLines.map(({ line, shop, presentment }, index) => {
    const isLast = index === eligibleLines.length - 1;
    const shopDiscount = isLast ? discountShop - allocatedShop : Math.round(discountShop * (shopBase ? shop / shopBase : 0) * 100) / 100;
    const presentmentDiscount = isLast ? discountPresentment - allocatedPresentment : Math.round(discountPresentment * (presentmentBase ? presentment / presentmentBase : 0) * 100) / 100;
    allocatedShop += shopDiscount;
    allocatedPresentment += presentmentDiscount;
    const shopUnit = Math.round((shop - shopDiscount) / line.quantity * 10_000) / 10_000;
    const presentmentUnit = Math.round((presentment - presentmentDiscount) / line.quantity * 10_000) / 10_000;
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      taxable: line.taxable,
      requiresShipping: line.requiresShipping,
      priceSet: {
        shopMoney: { amount: shopUnit.toFixed(4), currencyCode: "INR" },
        presentmentMoney: { amount: presentmentUnit.toFixed(4), currencyCode: "INR" },
      },
      taxLines: line.taxLines.map((tax) => ({
        title: tax.title,
        rate: tax.rate,
        channelLiable: tax.channelLiable ?? false,
        priceSet: {
          shopMoney: { amount: tax.priceSet.shopMoney.amount, currencyCode: tax.priceSet.shopMoney.currencyCode },
          presentmentMoney: { amount: tax.priceSet.presentmentMoney.amount, currencyCode: tax.priceSet.presentmentMoney.currencyCode },
        },
      })),
    };
  });
  const shippingLine = draft.shippingLine ? [{
    title: draft.shippingLine.title,
    priceSet: {
      shopMoney: { amount: draft.shippingLine.discountedPriceSet.shopMoney.amount, currencyCode: "INR" },
      presentmentMoney: { amount: draft.shippingLine.discountedPriceSet.presentmentMoney.amount, currencyCode: "INR" },
    },
    taxLines: draft.shippingLine.taxLines.map((tax) => ({
      title: tax.title,
      rate: tax.rate,
      channelLiable: tax.channelLiable ?? false,
      priceSet: {
        shopMoney: { amount: tax.priceSet.shopMoney.amount, currencyCode: tax.priceSet.shopMoney.currencyCode },
        presentmentMoney: { amount: tax.priceSet.presentmentMoney.amount, currencyCode: tax.priceSet.presentmentMoney.currencyCode },
      },
    })),
  }] : [];

  const sum = (key: "shop" | "presentment") => eligibleLines.reduce((total, item) => total + (key === "shop" ? item.shop : item.presentment), 0)
    - (key === "shop" ? discountShop : discountPresentment)
    + amount(draft.totalShippingPriceSet[key === "shop" ? "shopMoney" : "presentmentMoney"].amount)
    + (draft.taxesIncluded ? 0 : amount(draft.totalTaxSet[key === "shop" ? "shopMoney" : "presentmentMoney"].amount));
  const expectedShop = amount(draft.totalPriceSet.shopMoney.amount);
  const expectedPresentment = amount(draft.totalPriceSet.presentmentMoney.amount);
  if (!cashfreeAmountMatches(sum("shop"), expectedShop) || !cashfreeAmountMatches(sum("presentment"), expectedPresentment)) {
    throw new ShopifyCashfreeError("The saved tax, shipping, and discount totals cannot be reconciled safely.", 409);
  }

  const address = draft.shippingAddress;
  if (!address) throw new ShopifyCashfreeError("The saved order has no shipping address.", 409);
  const transactionAmount = expectedShop.toFixed(2);
  return {
    email: draft.email,
    phone: draft.phone,
    currency: "INR",
    presentmentCurrency: "INR",
    financialStatus: "PAID",
    test: true,
    taxesIncluded: draft.taxesIncluded,
    sourceName: "cashfree_sandbox",
    sourceIdentifier: orderId,
    tags: ["cashfree-sandbox", "beej-storefront"],
    note: `Cashfree sandbox payment ${orderId}; payment ${paymentId}`,
    shippingAddress: {
      firstName: address.firstName,
      lastName: address.lastName,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.province,
      provinceCode: address.provinceCode,
      countryCode: "IN",
      zip: address.zip,
      phone: address.phone,
    },
    billingAddress: {
      firstName: address.firstName,
      lastName: address.lastName,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.province,
      provinceCode: address.provinceCode,
      countryCode: "IN",
      zip: address.zip,
      phone: address.phone,
    },
    lineItems,
    shippingLines: shippingLine,
    transactions: [{
      kind: "SALE",
      status: "SUCCESS",
      test: true,
      gateway: "Cashfree Sandbox",
      authorizationCode: String(paymentId).slice(0, 255),
      amountSet: {
        shopMoney: { amount: transactionAmount, currencyCode: "INR" },
        presentmentMoney: { amount: expectedPresentment.toFixed(2), currencyCode: "INR" },
      },
      receiptJson: { cashfreeOrderId: orderId, cashfreePaymentId: String(paymentId) },
    }],
  };
}

export async function createCashfreeTestOrder(draft: CashfreeDraftQuote, orderId: string, paymentId: string): Promise<{ id: string; name: string; totalAmount: string }> {
  const mutation = `mutation BeejCashfreeTestOrder($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name totalPriceSet { presentmentMoney { amount currencyCode } } test displayFinancialStatus }
      userErrors { field message }
    }
  }`;
  const data = await adminGraphql<{ orderCreate?: { order?: { id: string; name: string; test: boolean; displayFinancialStatus: string; totalPriceSet: { presentmentMoney: Money } } | null; userErrors?: Array<{ message: string }> } | null }>(
    mutation,
    { order: buildTestOrderInput(draft, orderId, paymentId), options: { inventoryBehaviour: "BYPASS", sendReceipt: false, sendFulfillmentReceipt: false } },
  );
  const result = data.orderCreate;
  if (result?.userErrors?.length) throw new ShopifyCashfreeError(result.userErrors[0]?.message || "Shopify could not create the paid test order.");
  if (!result?.order?.id || !result.order.test || result.order.displayFinancialStatus !== "PAID") throw new ShopifyCashfreeError("Shopify did not confirm a paid test order.");
  if (!cashfreeAmountMatches(amount(result.order.totalPriceSet.presentmentMoney.amount), amount(draft.totalPriceSet.presentmentMoney.amount))) {
    throw new ShopifyCashfreeError("The Shopify test order total did not match the Cashfree payment.", 409);
  }
  return { id: result.order.id, name: result.order.name, totalAmount: result.order.totalPriceSet.presentmentMoney.amount };
}
