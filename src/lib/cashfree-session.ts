import "server-only";
import { cookies } from "next/headers";
import { getCashfreeConfig, readCashfreeCheckoutSession, serializeCashfreeCheckoutSession, type CashfreeCheckoutSession } from "@/lib/cashfree-core";

export const CASHFREE_SESSION_COOKIE_NAME = "beej-cashfree-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 2;

function signingSecret(): string {
  const config = getCashfreeConfig();
  if (!config) throw new Error("Cashfree sandbox is not configured.");
  return config.sessionSecret;
}

export async function storeCashfreeCheckoutSession(session: CashfreeCheckoutSession): Promise<void> {
  const jar = await cookies();
  jar.set(CASHFREE_SESSION_COOKIE_NAME, serializeCashfreeCheckoutSession(session, signingSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function readStoredCashfreeCheckoutSession(): Promise<CashfreeCheckoutSession | null> {
  const jar = await cookies();
  const secret = signingSecret();
  return readCashfreeCheckoutSession(jar.get(CASHFREE_SESSION_COOKIE_NAME)?.value, secret);
}

export async function clearCashfreeCheckoutSession(): Promise<void> {
  const jar = await cookies();
  jar.set(CASHFREE_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
