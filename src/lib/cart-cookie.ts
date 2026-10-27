import "server-only";
import { cookies } from "next/headers";
import { readCartCookie, serializeCartCookie } from "@/lib/commerce";

export const CART_COOKIE_NAME = "beej-cart";
export const CASHFREE_BUY_NOW_CART_COOKIE_NAME = "beej-buy-now-cart";
const CART_COOKIE_AGE = 60 * 60 * 24 * 7;

export async function readStoredCartId(): Promise<string | null> {
  const jar = await cookies();
  return readCartCookie(jar.get(CART_COOKIE_NAME)?.value);
}

export async function storeCartId(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CART_COOKIE_NAME, serializeCartCookie(cartId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CART_COOKIE_AGE,
  });
}

export async function clearStoredCartId(): Promise<void> {
  const jar = await cookies();
  jar.set(CART_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readStoredBuyNowCartId(): Promise<string | null> {
  const jar = await cookies();
  return readCartCookie(jar.get(CASHFREE_BUY_NOW_CART_COOKIE_NAME)?.value);
}

export async function storeBuyNowCartId(cartId: string): Promise<void> {
  const jar = await cookies();
  jar.set(CASHFREE_BUY_NOW_CART_COOKIE_NAME, serializeCartCookie(cartId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2,
  });
}

export async function clearBuyNowCartId(): Promise<void> {
  const jar = await cookies();
  jar.set(CASHFREE_BUY_NOW_CART_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
