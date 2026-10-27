import { createHmac, timingSafeEqual } from "node:crypto";

export const CASHFREE_SANDBOX_API = "https://sandbox.cashfree.com/pg";
export const CASHFREE_DEFAULT_API_VERSION = "2026-01-01";

export type CashfreeEnvironment = Record<string, string | undefined>;

export type CashfreeConfig = {
  appId: string;
  secretKey: string;
  sessionSecret: string;
  apiVersion: string;
};

export type CashfreeCheckoutSource = "bag" | "buy-now";

export type CashfreeCheckoutSession = {
  orderId: string;
  draftOrderId: string;
  cartId: string;
  source: CashfreeCheckoutSource;
  expiresAt: number;
};

export type CashfreeOrder = {
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: string;
  payment_session_id?: string;
  order_tags?: Record<string, string> | null;
};

export type CashfreePayment = {
  cf_payment_id: string | number;
  payment_status: string;
  payment_amount: number;
  payment_currency?: string;
  payment_completion_time?: string | null;
};

export class CashfreeError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
    this.name = "CashfreeError";
  }
}

export function getCashfreeConfig(env: CashfreeEnvironment = process.env): CashfreeConfig | null {
  const environment = (env.CASHFREE_ENVIRONMENT || "sandbox").trim().toLowerCase();
  if (environment !== "sandbox") return null;

  const appId = env.CASHFREE_APP_ID?.trim();
  const secretKey = env.CASHFREE_SECRET_KEY?.trim();
  const sessionSecret = env.CASHFREE_SESSION_SECRET?.trim();
  if (!appId || !secretKey || !sessionSecret) return null;

  const apiVersion = (env.CASHFREE_API_VERSION || CASHFREE_DEFAULT_API_VERSION).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(apiVersion) || sessionSecret.length < 32) return null;

  return { appId, secretKey, sessionSecret, apiVersion };
}

export function cashfreeCheckoutConfigured(env: CashfreeEnvironment = process.env): boolean {
  return Boolean(
    getCashfreeConfig(env)
    && env.SHOPIFY_MODE === "live"
    && env.SHOPIFY_ADMIN_CLIENT_ID?.trim()
    && env.SHOPIFY_ADMIN_CLIENT_SECRET?.trim()
    && (env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN?.trim() || env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN?.trim()),
  );
}

export function createCashfreeOrderId(uuid: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid)) {
    throw new CashfreeError("A valid checkout attempt is required.", 400);
  }
  return `beej_${uuid.replaceAll("-", "")}`;
}

export function verifyCashfreeWebhook(rawBody: string, timestamp: string, signature: string, secret: string): boolean {
  if (!rawBody || !timestamp || timestamp.length > 64 || !signature || signature.length > 512 || !secret) return false;
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}${rawBody}`, "utf8").digest();
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function serializeCashfreeCheckoutSession(session: CashfreeCheckoutSession, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${signPayload(payload, secret)}`;
}

export function readCashfreeCheckoutSession(value: string | undefined, secret: string, now = Date.now()): CashfreeCheckoutSession | null {
  if (!value || value.length > 2_048) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;

  const expected = Buffer.from(signPayload(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const candidate = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<CashfreeCheckoutSession>;
    if (
      typeof candidate.orderId !== "string" || !/^beej_[a-f0-9]{32}$/.test(candidate.orderId)
      || typeof candidate.draftOrderId !== "string" || !candidate.draftOrderId.startsWith("gid://shopify/DraftOrder/")
      || typeof candidate.cartId !== "string" || candidate.cartId.length > 512
      || (candidate.source !== "bag" && candidate.source !== "buy-now")
      || typeof candidate.expiresAt !== "number" || candidate.expiresAt <= now
    ) return null;
    return candidate as CashfreeCheckoutSession;
  } catch {
    return null;
  }
}

export function cashfreeAmountMatches(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.round(a * 100) === Math.round(b * 100);
}
