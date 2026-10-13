import { z } from "zod";
import { sanitizeAttributionState, type AttributionState } from "@/lib/tracking-attribution";
import type { ConsentPreferences, TrackingIdentifiers } from "@/lib/tracking-types";

const consentSchema = z.object({ analytics: z.boolean(), marketing: z.boolean(), preferences: z.boolean() }).strict();
const identifiersSchema = z.object({
  clientId: z.string().regex(/^\d{1,20}\.\d{1,20}$/).optional(),
  sessionId: z.string().regex(/^\d{1,20}$/).optional(),
  gclid: z.string().max(120).regex(/^[a-zA-Z0-9._~-]+$/).optional(),
  gbraid: z.string().max(120).regex(/^[a-zA-Z0-9._~-]+$/).optional(),
  wbraid: z.string().max(120).regex(/^[a-zA-Z0-9._~-]+$/).optional(),
  fbclid: z.string().max(120).regex(/^[a-zA-Z0-9._~-]+$/).optional(),
  fbp: z.string().max(120).regex(/^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/).optional(),
  fbc: z.string().max(120).regex(/^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/).optional(),
}).strict();
const requestSchema = z.object({ consent: consentSchema, attribution: z.unknown().optional(), identifiers: identifiersSchema.optional() }).strict();

export type ValidatedTrackingContext = {
  consent: ConsentPreferences;
  attribution?: AttributionState;
  identifiers: TrackingIdentifiers;
};

export function parseTrackingContextInput(value: unknown, siteOrigin: string, now = new Date()): ValidatedTrackingContext | null {
  const parsed = requestSchema.safeParse(value);
  if (!parsed.success) return null;
  const { consent } = parsed.data;
  let attribution: AttributionState | undefined;
  if (parsed.data.attribution !== undefined) {
    if (!(consent.analytics || consent.marketing)) return null;
    const sanitized = sanitizeAttributionState(parsed.data.attribution, siteOrigin, now);
    if (!sanitized) return null;
    attribution = sanitized;
  }
  const submitted = parsed.data.identifiers || {};
  const identifiers: TrackingIdentifiers = {};
  if (consent.analytics) {
    if (submitted.clientId) identifiers.clientId = submitted.clientId;
    if (submitted.sessionId) identifiers.sessionId = submitted.sessionId;
  }
  if (consent.marketing) {
    for (const key of ["gclid", "gbraid", "wbraid", "fbclid", "fbp", "fbc"] as const) {
      if (submitted[key]) identifiers[key] = submitted[key];
    }
  }
  return { consent, ...(attribution ? { attribution } : {}), identifiers };
}
