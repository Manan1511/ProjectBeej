import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeQuantity, toPublicShopifyCart, totalCartQuantity } from "@/lib/commerce";
import { clearStoredCartId, readStoredCartId, storeCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { addShopifyCartLines, applyShopifyCartLineTargets, createShopifyCart, getShopifyCart, getShopifyCartSnapshot, getStorefrontMode, removeShopifyCartLines, updateShopifyCartLines } from "@/lib/storefront";
import { clearClientCartAlias, getClientCartAlias, setClientCartAlias, withKeyedLock } from "@/lib/lock";
import { appendCartLine, CartActionError, setCartLineTargets } from "@/lib/cart-actions";

export const dynamic = "force-dynamic";
const addSchema = z.object({ variantId: z.string().min(1).max(200), quantity: z.unknown().optional(), clientKey: z.string().min(8).max(100).optional() });
const updateSchema = z.object({ lineId: z.string().min(1).max(300), quantity: z.unknown() });
const targetSchema = z.object({
  targets: z.array(z.object({
    variantId: z.string().min(1).max(200),
    quantity: z.number().int().min(0).max(10),
    baseQuantity: z.number().int().min(0).max(10).optional(),
  })).min(1).max(10),
  clientKey: z.string().min(8).max(100).optional(),
});

function errorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Shopify could not update the bag.";
  return cartJson({ error: message }, status);
}

function cartJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function mutationError(messages: Array<{ message: string }>) {
  return messages[0]?.message || "Shopify could not update the bag.";
}

export async function POST(request: NextRequest) {
  if (getStorefrontMode() === "preview") return cartJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  try {
    const parsed = addSchema.parse(await request.json());
    const quantity = normalizeQuantity(parsed.quantity ?? 1);
    const requestCartId = await readStoredCartId();
    const lockKey = requestCartId ? `cart:${requestCartId}` : `new-cart:${parsed.clientKey || request.headers.get("x-request-id") || crypto.randomUUID()}`;
    return await withKeyedLock(lockKey, async () => {
      const cartId = requestCartId || getClientCartAlias(parsed.clientKey);
      const buyerIp = await requestBuyerIp();
      const client = {
        getCart: (id: string) => getShopifyCartSnapshot(id, buyerIp),
        createCart: async (lines: Array<{ merchandiseId: string; quantity: number }>) => (await createShopifyCart(lines, buyerIp)).cartCreate,
        addLines: async (id: string, lines: Array<{ merchandiseId: string; quantity: number }>) => (await addShopifyCartLines(id, lines, buyerIp)).cartLinesAdd,
      };
      const result = await appendCartLine(client, cartId, { merchandiseId: parsed.variantId, quantity });
      await storeCartId(result.cart.id);
      setClientCartAlias(parsed.clientKey, result.cart.id);
      const publicCart = toPublicShopifyCart(result.cart);
      return cartJson({ cart: publicCart, cartId: publicCart.id, acceptedQuantity: result.addedQuantity, warnings: result.warnings, recovered: result.recovered });
    });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(new Error("Choose a product variant before adding it to your bag."));
    if (error instanceof CartActionError) return errorResponse(error, error.status);
    if (error instanceof Error && (error.message.includes("up to") || error.message.startsWith("Choose a whole number"))) return errorResponse(error, 422);
    return errorResponse(error, 502);
  }
}

export async function PUT(request: NextRequest) {
  if (getStorefrontMode() === "preview") return cartJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  try {
    const parsed = targetSchema.parse(await request.json());
    const requestCartId = await readStoredCartId();
    const lockKey = requestCartId ? `cart:${requestCartId}` : `new-cart:${parsed.clientKey || crypto.randomUUID()}`;
    return await withKeyedLock(lockKey, async () => {
      const cartId = requestCartId || getClientCartAlias(parsed.clientKey);
      const buyerIp = await requestBuyerIp();
      const client = {
        getCart: (id: string) => getShopifyCart(id, buyerIp),
        createCart: async (lines: Array<{ merchandiseId: string; quantity: number }>) => {
          const result = await createShopifyCart(lines, buyerIp);
          return result.cartCreate;
        },
        applyTargets: (id: string, operations: Parameters<typeof applyShopifyCartLineTargets>[1]) => applyShopifyCartLineTargets(id, operations, buyerIp),
      };
      const result = await setCartLineTargets(client, cartId, parsed.targets);
      if (result.recovered) await clearStoredCartId();
      if (result.cart) await storeCartId(result.cart.id);
      else if (cartId) {
        await clearStoredCartId();
        clearClientCartAlias(parsed.clientKey);
      }
      if (result.cart) setClientCartAlias(parsed.clientKey, result.cart.id);
      const publicCart = result.cart ? toPublicShopifyCart(result.cart) : null;
      return cartJson({ cart: publicCart, cartId: publicCart?.id || null, changes: result.changes, warnings: result.warnings, recovered: result.recovered });
    });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(new Error("Choose a valid product quantity before updating your bag."));
    if (error instanceof CartActionError) return errorResponse(error, error.status);
    if (error instanceof Error && error.message.includes("Choose a whole number")) return errorResponse(error, 422);
    return errorResponse(error, 502);
  }
}

export async function PATCH(request: NextRequest) {
  if (getStorefrontMode() === "preview") return cartJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  try {
    const parsed = updateSchema.parse(await request.json());
    const quantity = normalizeQuantity(parsed.quantity);
    const cartId = await readStoredCartId();
    if (!cartId) return errorResponse(new Error("Your bag has expired. Start a new bag to continue."), 410);

    return await withKeyedLock(`cart:${cartId}`, async () => {
      const buyerIp = await requestBuyerIp();
      const cart = await getShopifyCartSnapshot(cartId, buyerIp);
      if (!cart) {
        await clearStoredCartId();
        return errorResponse(new Error("Your bag has expired. Start a new bag to continue."), 410);
      }
      const target = cart.lines.find((line) => line.id === parsed.lineId);
      if (!target) return errorResponse(new Error("That item is no longer in your bag. Refresh and try again."), 404);
      totalCartQuantity([...cart.lines.filter((line) => line.id !== parsed.lineId).map((line) => ({ quantity: line.quantity })), { quantity }]);
      const result = await updateShopifyCartLines(cartId, [{ id: parsed.lineId, quantity }], buyerIp);
      const updated = result.cartLinesUpdate;
      if (updated.userErrors.length || !updated.cart) return errorResponse(new Error(mutationError(updated.userErrors)), 422);
      const updatedQuantity = updated.cart.lines.find((line) => line.id === target.id)?.quantity || 0;
      const quantityDelta = updatedQuantity - target.quantity;
      return cartJson({ cart: toPublicShopifyCart(updated.cart), acceptedQuantity: Math.max(0, quantityDelta), removedQuantity: Math.max(0, -quantityDelta), warnings: updated.warnings });
    });
  } catch (error) {
    if (error instanceof z.ZodError || (error instanceof Error && error.message.includes("Choose a whole number"))) return errorResponse(error);
    if (error instanceof Error && error.message.includes("up to")) return errorResponse(error, 422);
    return errorResponse(error, 502);
  }
}

export async function DELETE(request: NextRequest) {
  if (getStorefrontMode() === "preview") return cartJson({ error: "Purchases are disabled while the storefront is in preview mode." }, 503);
  const lineId = request.nextUrl.searchParams.get("lineId");
  const cartId = await readStoredCartId();
  if (!lineId || !cartId) return errorResponse(new Error("That bag item could not be found."), 404);
  try {
    return await withKeyedLock(`cart:${cartId}`, async () => {
      const buyerIp = await requestBuyerIp();
      const cart = await getShopifyCartSnapshot(cartId, buyerIp);
      if (!cart) {
        await clearStoredCartId();
        return errorResponse(new Error("Your bag has expired. Start a new bag to continue."), 410);
      }
      const target = cart.lines.find((line) => line.id === lineId);
      if (!target) return errorResponse(new Error("That item is no longer in your bag."), 404);
      const result = await removeShopifyCartLines(cartId, [lineId], buyerIp);
      const updated = result.cartLinesRemove;
      if (updated.userErrors.length || !updated.cart) return errorResponse(new Error(mutationError(updated.userErrors)), 422);
      if (updated.cart.totalQuantity === 0) await clearStoredCartId();
      return cartJson({ cart: toPublicShopifyCart(updated.cart), removedQuantity: target.quantity, warnings: updated.warnings });
    });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
