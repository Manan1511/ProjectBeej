import type { ConsentPreferences } from "@/lib/tracking-types";

export function providerConsentAllowed(
  provider: "ga4" | "meta",
  orderConsent: Partial<ConsentPreferences> | null,
  currentConsent: Partial<ConsentPreferences> | null,
): boolean {
  if (!orderConsent || !currentConsent) return false;
  const key = provider === "ga4" ? "analytics" : "marketing";
  return orderConsent[key] === true && currentConsent[key] === true;
}

const RETRY_DELAYS_MS = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];

export function nextTrackingRetry(attempts: number, now = new Date()): Date | null {
  if (!Number.isSafeInteger(attempts) || attempts < 1) return null;
  const delay = RETRY_DELAYS_MS[attempts - 1];
  return delay === undefined ? null : new Date(now.getTime() + delay);
}

export function providerTimestampExpired(payload: Record<string, unknown>, now = new Date(), maxAgeHours = 72): boolean {
  const raw = payload.timestamp_micros;
  if (typeof raw !== "number" && typeof raw !== "string") return false;
  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return true;
  const currentMicros = now.getTime() * 1000;
  if (timestamp > currentMicros + 5 * 60 * 1_000_000) return true;
  return currentMicros - timestamp > maxAgeHours * 60 * 60 * 1_000_000;
}
