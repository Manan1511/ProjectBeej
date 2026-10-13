import type { StoredCheckoutContext } from "@/lib/tracking-store";

export type CartAttribute = { key: string; value: string };

export function mergeCheckoutAttributes(existing: CartAttribute[], tracking: CartAttribute[]): CartAttribute[] {
  const values = new Map<string, string>();
  for (const item of existing) {
    if (typeof item.key === "string" && typeof item.value === "string") values.set(item.key, item.value);
  }
  for (const item of tracking) values.set(item.key, item.value);
  for (const key of [...values.keys()]) if (key.startsWith("beej_")) values.delete(key);
  for (const item of tracking) values.set(item.key, item.value);
  return [...values].slice(0, 250).map(([key, value]) => ({ key, value }));
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const safe = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").trim().slice(0, 220);
  return safe || undefined;
}

export function buildCheckoutTrackingAttributes(context: StoredCheckoutContext, capability: string): CartAttribute[] {
  const attributes: CartAttribute[] = [];
  const add = (key: string, value: unknown) => {
    const safe = text(value);
    if (safe) attributes.push({ key, value: safe });
  };
  add("beej_tracking_context", capability);

  const identifiers = context.identifiers || {};
  if (context.consent.analytics) {
    add("beej_ga_client_id", identifiers.clientId);
    add("beej_ga_session_id", identifiers.sessionId);
  }
  if (context.consent.marketing) {
    for (const key of ["gclid", "gbraid", "wbraid", "fbclid", "fbp", "fbc"] as const) {
      add(`beej_${key}`, identifiers[key]);
    }
  }

  if (context.consent.analytics || context.consent.marketing) {
    const attribution = context.attribution as Record<string, unknown> | null;
    for (const side of ["firstTouch", "lastTouch"] as const) {
      const touch = attribution?.[side];
      if (!touch || typeof touch !== "object" || Array.isArray(touch)) continue;
      const record = touch as Record<string, unknown>;
      const prefix = side === "firstTouch" ? "beej_first" : "beej_last";
      for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"] as const) {
        add(`${prefix}_${key}`, record[key]);
      }
      add(`${prefix}_landing`, record.landingPath);
      add(`${prefix}_referrer`, record.referrerOrigin);
    }
  }
  return attributes;
}
