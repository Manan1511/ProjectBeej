export type CampaignTouch = Partial<Record<
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_id" | "utm_content" | "utm_term",
  string
>> & {
  landingPath: string;
  referrerOrigin?: string;
  capturedAt: string;
};

export type AttributionState = {
  firstTouch: CampaignTouch;
  lastTouch: CampaignTouch;
};

export type AdvertisingIdentifiers = Partial<Record<
  "gclid" | "gbraid" | "wbraid" | "fbclid" | "fbp" | "fbc",
  string
>>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"] as const;
const CLICK_KEYS = ["gclid", "gbraid", "wbraid", "fbclid"] as const;
const CONTACT_EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i;
const CONTACT_PHONE = /(?:\+?\d[\d\s().-]{6,}\d)/;

function safeValue(value: string | null | undefined): string | undefined {
  const normalized = value?.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 100 || CONTACT_EMAIL.test(normalized) || CONTACT_PHONE.test(normalized)) return undefined;
  return normalized;
}

function safePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : "/";
  return path.slice(0, 180).replace(/[\u0000-\u001f\u007f]/g, "");
}

function safeOrigin(value: string, siteOrigin: string): string | undefined {
  try {
    const url = new URL(value);
    const current = new URL(siteOrigin);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || url.origin === current.origin) return undefined;
    return url.origin.slice(0, 180);
  } catch {
    return undefined;
  }
}

function sanitizeTouch(value: unknown, siteOrigin: string, now: Date): CampaignTouch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.landingPath !== "string" || typeof record.capturedAt !== "string") return null;

  const capturedAt = new Date(record.capturedAt);
  if (!Number.isFinite(capturedAt.getTime()) || capturedAt.getTime() > now.getTime() + 5 * 60_000 || now.getTime() - capturedAt.getTime() > 30 * 24 * 60 * 60_000) return null;

  let landing: URL;
  try {
    if (!record.landingPath.startsWith("/") || record.landingPath.startsWith("//")) return null;
    landing = new URL(record.landingPath, siteOrigin);
    if (landing.origin !== new URL(siteOrigin).origin || landing.search || landing.hash || landing.username || landing.password) return null;
  } catch {
    return null;
  }

  const touch: CampaignTouch = {
    landingPath: safePath(landing.pathname),
    capturedAt: capturedAt.toISOString(),
  };
  for (const key of UTM_KEYS) {
    const raw = record[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return null;
    const safe = safeValue(raw);
    if (!safe) return null;
    touch[key] = safe;
  }

  if (record.referrerOrigin !== undefined) {
    if (typeof record.referrerOrigin !== "string") return null;
    const referrerOrigin = safeOrigin(record.referrerOrigin, siteOrigin);
    if (!referrerOrigin || referrerOrigin !== record.referrerOrigin) return null;
    touch.referrerOrigin = referrerOrigin;
  }
  if (!UTM_KEYS.some((key) => Boolean(touch[key])) && !touch.referrerOrigin) return null;
  return touch;
}

export function sanitizeAttributionState(value: unknown, siteOrigin: string, now = new Date()): AttributionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const firstTouch = sanitizeTouch(record.firstTouch, siteOrigin, now);
  const lastTouch = sanitizeTouch(record.lastTouch, siteOrigin, now);
  if (!firstTouch || !lastTouch || Date.parse(firstTouch.capturedAt) > Date.parse(lastTouch.capturedAt)) return null;
  return { firstTouch, lastTouch };
}

export function captureCampaignTouch(
  pageUrl: string,
  referrer: string,
  siteOrigin: string,
  now = new Date(),
): CampaignTouch | null {
  let url: URL;
  try {
    url = new URL(pageUrl, siteOrigin);
    if (url.origin !== new URL(siteOrigin).origin || url.username || url.password) return null;
  } catch {
    return null;
  }

  if (referrer) {
    try {
      if (new URL(referrer).origin === new URL(siteOrigin).origin) return null;
    } catch {
      // Invalid referrers are ignored and never stored.
    }
  }
  const referrerOrigin = referrer ? safeOrigin(referrer, siteOrigin) : undefined;
  const touch: CampaignTouch = {
    landingPath: safePath(url.pathname),
    capturedAt: now.toISOString(),
    ...(referrerOrigin ? { referrerOrigin } : {}),
  };
  for (const key of UTM_KEYS) {
    const rawValue = url.searchParams.get(key);
    const value = safeValue(rawValue);
    if (rawValue && !value) return null;
    if (value) touch[key] = value;
  }

  const hasCampaign = UTM_KEYS.some((key) => Boolean(touch[key]));
  if (!hasCampaign && !referrerOrigin) return null;
  return touch;
}

export function mergeAttribution(existing: AttributionState | null, incoming: CampaignTouch | null): AttributionState | null {
  if (!incoming) return existing;
  return {
    firstTouch: existing?.firstTouch ?? incoming,
    lastTouch: incoming,
  };
}

export function captureClickIdentifiers(pageUrl: string, cookieString: string, marketingConsent: boolean): AdvertisingIdentifiers {
  if (!marketingConsent) return {};
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return {};
  }

  const identifiers: AdvertisingIdentifiers = {};
  for (const key of CLICK_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value && value.length <= 120 && /^[a-zA-Z0-9._~-]+$/.test(value)) identifiers[key] = value;
  }
  const cookies = new Map(cookieString.split(";").map((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return [part.trim(), ""];
    let value = part.slice(separator + 1).trim();
    try { value = decodeURIComponent(value); } catch { value = ""; }
    return [part.slice(0, separator).trim(), value];
  }));
  for (const [cookieName, key] of [["_fbp", "fbp"], ["_fbc", "fbc"]] as const) {
    const value = cookies.get(cookieName);
    if (value && value.length <= 120 && /^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/.test(value)) identifiers[key] = value;
  }
  return identifiers;
}

export function sanitizeSearchTerm(value: string): string {
  const term = value.split(/[&?#]/, 1)[0]?.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "";
  if (CONTACT_EMAIL.test(term) || CONTACT_PHONE.test(term)) return "";
  return term;
}
