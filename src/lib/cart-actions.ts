import { totalCartQuantity } from "@/lib/commerce";
import type { ShopifyCart } from "@/lib/types";

export type CartLineInput = { merchandiseId: string; quantity: number };
export type CartMutationResult = {
  cart: ShopifyCart | null;
  userErrors: Array<{ message: string }>;
  warnings: Array<{ message: string }>;
};

export type CartMutationClient = {
  getCart(cartId: string): Promise<ShopifyCart | null>;
  createCart(lines: CartLineInput[]): Promise<CartMutationResult>;
  addLines(cartId: string, lines: CartLineInput[]): Promise<CartMutationResult>;
};

export class CartActionError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "CartActionError";
  }
}

function unwrap(result: CartMutationResult): ShopifyCart {
  if (result.userErrors.length || !result.cart) throw new CartActionError(result.userErrors[0]?.message || "Shopify could not update your bag.");
  return result.cart;
}

export async function appendCartLine(
  client: CartMutationClient,
  existingCartId: string | null,
  line: CartLineInput,
): Promise<{ cart: ShopifyCart; warnings: Array<{ message: string }>; recovered: boolean }> {
  if (!existingCartId) {
    const result = await client.createCart([line]);
    return { cart: unwrap(result), warnings: result.warnings, recovered: false };
  }

  const cart = await client.getCart(existingCartId);
  if (!cart) {
    const result = await client.createCart([line]);
    return { cart: unwrap(result), warnings: result.warnings, recovered: true };
  }

  totalCartQuantity([...cart.lines.map((item) => ({ quantity: item.quantity })), { quantity: line.quantity }]);
  const result = await client.addLines(existingCartId, [line]);
  return { cart: unwrap(result), warnings: result.warnings, recovered: false };
}

/** Creates a separate one-product cart; it intentionally has no access to the bag cookie or mutation method. */
export async function createBuyNowCart(
  createCart: (lines: CartLineInput[]) => Promise<CartMutationResult>,
  line: CartLineInput,
): Promise<{ cart: ShopifyCart; warnings: Array<{ message: string }> }> {
  const result = await createCart([line]);
  return { cart: unwrap(result), warnings: result.warnings };
}

export function trustedCheckoutUrl(raw: string, storeDomain: string, customHosts: string[] = []): string {
  const checkoutUrl = new URL(raw);
  const allowedCustomHosts = customHosts.map((host) => host.trim().toLowerCase()).filter((host) => /^[a-z0-9.-]+$/.test(host));
  const allowedHost = checkoutUrl.hostname === storeDomain || checkoutUrl.hostname.endsWith(".myshopify.com") || checkoutUrl.hostname.endsWith(".shopify.com") || allowedCustomHosts.includes(checkoutUrl.hostname.toLowerCase());
  if (checkoutUrl.protocol !== "https:" || !allowedHost) throw new Error("Shopify returned an invalid checkout URL.");
  return checkoutUrl.toString();
}
