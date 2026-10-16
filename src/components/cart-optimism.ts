import type { ShopifyCart } from "@/lib/types";

/** Updates the visible quantity while leaving Shopify-calculated money authoritative. */
export function optimisticCartQuantity(cart: ShopifyCart, lineId: string, quantity: number): ShopifyCart {
  if (!Number.isSafeInteger(quantity) || quantity < 0) return cart;
  const line = cart.lines.find((item) => item.id === lineId);
  if (!line) return cart;

  const totalQuantity = Math.max(0, cart.totalQuantity + quantity - line.quantity);
  const lines = quantity === 0
    ? cart.lines.filter((item) => item.id !== lineId)
    : cart.lines.map((item) => item.id === lineId ? { ...item, quantity } : item);

  return { ...cart, totalQuantity, lines };
}
