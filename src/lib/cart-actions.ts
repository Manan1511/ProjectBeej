import { MAX_CART_QUANTITY, MAX_LINE_QUANTITY, totalCartQuantity } from "@/lib/commerce";
import type { ShopifyCart, ShopifyCartSnapshot } from "@/lib/types";

export type CartLineInput = { merchandiseId: string; quantity: number };
export type CartMutationResult = {
  cart: ShopifyCart | null;
  userErrors: Array<{ message: string }>;
  warnings: Array<{ message: string }>;
};

export type CartMutationClient = {
  getCart(cartId: string): Promise<ShopifyCartSnapshot | null>;
  createCart(lines: CartLineInput[]): Promise<CartMutationResult>;
  addLines(cartId: string, lines: CartLineInput[]): Promise<CartMutationResult>;
};

export type CartQuantityTarget = { variantId: string; quantity: number; baseQuantity?: number };
export type CartTargetOperations = {
  updates: Array<{ id: string; quantity: number }>;
  removals: string[];
  additions: CartLineInput[];
};
export type CartTargetClient = {
  getCart(cartId: string): Promise<ShopifyCart | null>;
  createCart(lines: CartLineInput[]): Promise<CartMutationResult>;
  applyTargets(cartId: string, operations: CartTargetOperations): Promise<CartMutationResult>;
};
export type CartQuantityChange = {
  variantId: string;
  previousQuantity: number;
  quantity: number;
  acceptedQuantity: number;
  removedQuantity: number;
};

export class CartActionError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = "CartActionError";
  }
}

function validateCartTargets(targets: CartQuantityTarget[]): CartQuantityTarget[] {
  if (targets.length > MAX_CART_QUANTITY) throw new CartActionError(`Your bag can hold up to ${MAX_CART_QUANTITY} items.`);
  const seen = new Set<string>();
  return targets.map(({ variantId, quantity, baseQuantity }) => {
    if (typeof variantId !== "string" || variantId.length < 1 || variantId.length > 200 || seen.has(variantId)) {
      throw new CartActionError("Each product variant can only appear once in a bag update.");
    }
    seen.add(variantId);
    if (!Number.isSafeInteger(quantity) || quantity < 0 || quantity > MAX_LINE_QUANTITY) {
      throw new CartActionError(`Choose a whole number between 0 and ${MAX_LINE_QUANTITY}.`);
    }
    if (baseQuantity !== undefined && (!Number.isSafeInteger(baseQuantity) || baseQuantity < 0 || baseQuantity > MAX_LINE_QUANTITY)) {
      throw new CartActionError(`Choose a whole number between 0 and ${MAX_LINE_QUANTITY}.`);
    }
    return { variantId, quantity, ...(baseQuantity === undefined ? {} : { baseQuantity }) };
  });
}

function lineQuantities(cart: ShopifyCart | null): Map<string, number> {
  const quantities = new Map<string, number>();
  for (const line of cart?.lines || []) quantities.set(line.merchandise.id, (quantities.get(line.merchandise.id) || 0) + line.quantity);
  return quantities;
}

function targetChanges(targets: CartQuantityTarget[], before: Map<string, number>, cart: ShopifyCart | null): CartQuantityChange[] {
  const after = lineQuantities(cart);
  return targets.map(({ variantId }) => {
    const previousQuantity = before.get(variantId) || 0;
    const quantity = after.get(variantId) || 0;
    return {
      variantId,
      previousQuantity,
      quantity,
      acceptedQuantity: Math.max(0, quantity - previousQuantity),
      removedQuantity: Math.max(0, previousQuantity - quantity),
    };
  });
}

function mutationWarnings(result: CartMutationResult): Array<{ message: string }> {
  return [...result.warnings, ...result.userErrors.map(({ message }) => ({ message }))];
}

function requireMutationCart(result: CartMutationResult): ShopifyCart {
  if (!result.cart) throw new CartActionError(result.userErrors[0]?.message || "Shopify could not update your bag.");
  return result.cart;
}

/** Applies one validated set of absolute variant quantities using a single grouped mutation. */
export async function setCartLineTargets(
  client: CartTargetClient,
  existingCartId: string | null,
  requestedTargets: CartQuantityTarget[],
): Promise<{ cart: ShopifyCart | null; warnings: Array<{ message: string }>; recovered: boolean; changes: CartQuantityChange[] }> {
  const requested = validateCartTargets(requestedTargets);
  let cart = existingCartId ? await client.getCart(existingCartId) : null;
  const recovered = Boolean(existingCartId && !cart);
  const before = lineQuantities(cart);
  const targets = requested.map((target) => {
    if (target.baseQuantity === undefined) return target;
    const currentQuantity = before.get(target.variantId) || 0;
    const baseline = cart || !recovered ? currentQuantity : 0;
    return { ...target, quantity: Math.max(0, Math.min(MAX_LINE_QUANTITY, baseline + target.quantity - target.baseQuantity)) };
  });

  if (cart) {
    const currentTotal = cart.lines.reduce((sum, line) => sum + line.quantity, 0);
    const nextTotal = targets.reduce((sum, target) => sum + target.quantity - (before.get(target.variantId) || 0), currentTotal);
    if (nextTotal > MAX_CART_QUANTITY) throw new CartActionError(`Your bag can hold up to ${MAX_CART_QUANTITY} items.`);
    if (nextTotal < 0) throw new CartActionError("That bag quantity could not be applied.");
  } else {
    const total = targets.reduce((sum, target) => sum + target.quantity, 0);
    if (total > MAX_CART_QUANTITY) throw new CartActionError(`Your bag can hold up to ${MAX_CART_QUANTITY} items.`);
  }

  const positiveTargets = targets.filter((target) => target.quantity > 0);
  const removedOnly = targets.every((target) => target.quantity === 0);

  if (!cart && positiveTargets.length === 0) {
    return { cart: null, warnings: [], recovered, changes: targetChanges(targets, before, null) };
  }

  if (!cart) {
    const result = await client.createCart(positiveTargets.map(({ variantId, quantity }) => ({ merchandiseId: variantId, quantity })));
    cart = requireMutationCart(result);
    return { cart, warnings: mutationWarnings(result), recovered, changes: targetChanges(targets, before, cart) };
  }

  const updates: CartTargetOperations["updates"] = [];
  const removals: string[] = [];
  const additions: CartLineInput[] = [];
  for (const target of targets) {
    const matches = cart.lines.filter((line) => line.merchandise.id === target.variantId);
    if (matches.length === 0) {
      if (target.quantity > 0) additions.push({ merchandiseId: target.variantId, quantity: target.quantity });
      continue;
    }
    if (target.quantity === 0) {
      removals.push(...matches.map((line) => line.id));
      continue;
    }
    const [primary, ...duplicates] = matches;
    if (primary && primary.quantity !== target.quantity) updates.push({ id: primary.id, quantity: target.quantity });
    removals.push(...duplicates.map((line) => line.id));
  }

  if (removedOnly && targets.every(({ variantId }) => (before.get(variantId) || 0) === 0)) {
    return { cart, warnings: [], recovered, changes: targetChanges(targets, before, cart) };
  }
  if (!updates.length && !removals.length && !additions.length) {
    return { cart, warnings: [], recovered, changes: targetChanges(targets, before, cart) };
  }

  const result = await client.applyTargets(cart.id, { updates, removals, additions });
  cart = requireMutationCart(result);
  return { cart, warnings: mutationWarnings(result), recovered, changes: targetChanges(targets, before, cart) };
}

function variantQuantity(cart: ShopifyCart | ShopifyCartSnapshot, variantId: string): number {
  return cart.lines.reduce((sum, line) => sum + (line.merchandise.id === variantId ? line.quantity : 0), 0);
}

function unwrap(result: CartMutationResult): ShopifyCart {
  if (result.userErrors.length || !result.cart) throw new CartActionError(result.userErrors[0]?.message || "Shopify could not update your bag.");
  return result.cart;
}

export async function appendCartLine(
  client: CartMutationClient,
  existingCartId: string | null,
  line: CartLineInput,
): Promise<{ cart: ShopifyCart; warnings: Array<{ message: string }>; recovered: boolean; addedQuantity: number }> {
  if (!existingCartId) {
    const result = await client.createCart([line]);
    const createdCart = unwrap(result);
    return { cart: createdCart, warnings: result.warnings, recovered: false, addedQuantity: Math.min(line.quantity, variantQuantity(createdCart, line.merchandiseId)) };
  }

  const cart = await client.getCart(existingCartId);
  if (!cart) {
    const result = await client.createCart([line]);
    const recoveredCart = unwrap(result);
    return { cart: recoveredCart, warnings: result.warnings, recovered: true, addedQuantity: Math.min(line.quantity, variantQuantity(recoveredCart, line.merchandiseId)) };
  }

  totalCartQuantity([...cart.lines.map((item) => ({ quantity: item.quantity })), { quantity: line.quantity }]);
  const result = await client.addLines(existingCartId, [line]);
  const updatedCart = unwrap(result);
  const previousQuantity = variantQuantity(cart, line.merchandiseId);
  const acceptedDelta = Math.max(0, variantQuantity(updatedCart, line.merchandiseId) - previousQuantity);
  return { cart: updatedCart, warnings: result.warnings, recovered: false, addedQuantity: Math.min(line.quantity, acceptedDelta) };
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
