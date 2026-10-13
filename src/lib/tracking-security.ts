import { createHmac, timingSafeEqual } from "node:crypto";
import type { ConsentPreferences } from "@/lib/tracking-types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function constantTimeTextEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function verifyShopifyWebhookHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const provided = Buffer.from(signature, "base64");
  if (provided.length !== 32) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(expected, provided);
}

export function createConsentCapability(contextId: string, secret: string, now = Date.now(), ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  if (!UUID_PATTERN.test(contextId) || !secret || !Number.isSafeInteger(ttlMs) || ttlMs < 1) throw new Error("Tracking consent capability cannot be created.");
  const expiresAt = Math.floor((now + ttlMs) / 1000);
  const payload = `${contextId}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(`v1.${payload}`).digest("base64url");
  return `v1.${payload}.${signature}`;
}

export function createTrackingContextCookie(
  visitorId: string,
  contextId: string,
  secret: string,
  now = Date.now(),
  ttlMs = 180 * 24 * 60 * 60 * 1000,
): string {
  if (!UUID_PATTERN.test(visitorId) || !UUID_PATTERN.test(contextId) || !secret || !Number.isSafeInteger(ttlMs) || ttlMs < 1) {
    throw new Error("Tracking context cookie cannot be created.");
  }
  const expiresAt = Math.floor((now + ttlMs) / 1000);
  const payload = `${visitorId}.${contextId}.${expiresAt}`;
  const signature = createHmac("sha256", secret).update(`v1.${payload}`).digest("base64url");
  return `v1.${payload}.${signature}`;
}

export function verifyTrackingContextCookie(token: string, secret: string, now = Date.now()): { visitorId: string; contextId: string } | null {
  if (!secret) return null;
  const match = /^v1\.([0-9a-f-]{36})\.([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{43})$/i.exec(token);
  if (!match || !UUID_PATTERN.test(match[1]!) || !UUID_PATTERN.test(match[2]!)) return null;
  const expiresAt = Number(match[3]) * 1000;
  if (!Number.isSafeInteger(expiresAt) || now > expiresAt) return null;
  const expected = createHmac("sha256", secret).update(`v1.${match[1]}.${match[2]}.${match[3]}`).digest("base64url");
  return constantTimeTextEqual(expected, match[4]!) ? { visitorId: match[1]!, contextId: match[2]! } : null;
}

export function verifyConsentCapability(token: string, secret: string, now = Date.now()): string | null {
  if (!secret) return null;
  const match = /^v1\.([0-9a-f-]{36})\.(\d{10})\.([A-Za-z0-9_-]{43})$/i.exec(token);
  if (!match || !UUID_PATTERN.test(match[1]!)) return null;
  const expiresAt = Number(match[2]) * 1000;
  if (!Number.isSafeInteger(expiresAt) || now > expiresAt) return null;
  const expected = createHmac("sha256", secret).update(`v1.${match[1]}.${match[2]}`).digest("base64url");
  return constantTimeTextEqual(expected, match[3]!) ? match[1]! : null;
}

export function isConsentReduction(current: ConsentPreferences, requested: ConsentPreferences): boolean {
  return (Object.keys(current) as Array<keyof ConsentPreferences>).every((key) =>
    typeof requested[key] === "boolean" && (current[key] || !requested[key]),
  );
}
