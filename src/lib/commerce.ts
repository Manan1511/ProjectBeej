export const FREE_SHIPPING_THRESHOLD = 499;
export const SHIPPING_FEE = 49;
export const MAX_LINE_QUANTITY = 10;
export const MAX_CART_QUANTITY = 10;

export function normalizeQuantity(input: unknown): number {
  const quantity = typeof input === "string" && /^\d+$/.test(input) ? Number(input) : input;

  if (
    typeof quantity !== "number" ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_LINE_QUANTITY
  ) {
    throw new Error(`Choose a whole number between 1 and ${MAX_LINE_QUANTITY}.`);
  }

  return quantity;
}

export function totalCartQuantity(lines: ReadonlyArray<{ quantity: number }>): number {
  const total = lines.reduce((sum, line) => sum + normalizeQuantity(line.quantity), 0);

  if (total > MAX_CART_QUANTITY) {
    throw new Error(`Your bag can hold up to ${MAX_CART_QUANTITY} items.`);
  }

  return total;
}

export function buildShippingEstimate(rawSubtotal: string) {
  if (!/^\d+(?:\.00)?$/.test(rawSubtotal)) {
    throw new Error("Expected a whole-rupee INR subtotal from Shopify.");
  }

  const subtotal = Number(rawSubtotal);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0) {
    throw new Error("Expected a valid whole-rupee INR subtotal from Shopify.");
  }

  const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  return {
    subtotal,
    fee: qualifiesForFreeShipping ? 0 : SHIPPING_FEE,
    amountUntilFree: Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal),
    qualifiesForFreeShipping,
  };
}

export function assertVariantPurchasable(
  variant: { availableForSale: boolean; quantityAvailable?: number | null },
  requestedQuantity: number,
): void {
  normalizeQuantity(requestedQuantity);
  if (!variant.availableForSale) throw new Error("This item is currently unavailable.");
  if (typeof variant.quantityAvailable === "number" && variant.quantityAvailable < requestedQuantity) {
    throw new Error("There is not enough stock for that quantity.");
  }
}

export function serializeCartCookie(value: string): string {
  if (!value.startsWith("gid://shopify/Cart/")) throw new Error("Invalid Shopify cart ID.");
  return value;
}

export function readCartCookie(value: string | undefined): string | null {
  if (!value?.startsWith("gid://shopify/Cart/")) return null;
  return value;
}

export function formatINR(amount: string | number): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(value) || value < 0) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
