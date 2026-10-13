"use client";

import { captureCampaignTouch, captureClickIdentifiers, mergeAttribution, sanitizeAttributionState, sanitizeSearchTerm, type AttributionState } from "@/lib/tracking-attribution";
import { canEmitCommerceEvent, makeVariantTrackingId, sanitizeTelemetryLocation, type CommerceEvent } from "@/lib/tracking-events";
import type { PublicTrackingConfig } from "@/lib/tracking-config";
import type { ConsentPreferences, StoredConsent, TrackingIdentifiers } from "@/lib/tracking-types";
import type { CurrencyCode } from "@shopify/hydrogen-react/storefront-api-types";

const CONSENT_KEY = "beej:consent:v1";
const ATTRIBUTION_KEY = "beej:attribution:v1";
const IDENTIFIERS_KEY = "beej:tracking-identifiers:v1";
const CONSENT_TTL = 180 * 24 * 60 * 60 * 1000;
const ATTRIBUTION_TTL = 30 * 24 * 60 * 60 * 1000;

type ShopifyProduct = {
  productGid: string;
  variantGid: string;
  name: string;
  variantName?: string;
  brand: string;
  category?: string;
  price: string;
  sku?: string;
  quantity: number;
};

type TrackingRuntime = {
  config: PublicTrackingConfig;
  consent: ConsentPreferences;
  shopId: string;
  currency: string;
};

type EmitOptions = { shopifyCartId?: string; shopifyProducts?: ShopifyProduct[] };
type QueuedCommerceEvent = { event: CommerceEvent; options: EmitOptions };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __beejGtmLoaded?: boolean;
    __beejConsentInitialized?: boolean;
  }
}

let runtime: TrackingRuntime | null = null;
let initialTouch: ReturnType<typeof captureCampaignTouch> | undefined;
let memoryConsent: StoredConsent | null = null;
const pendingEvents: QueuedCommerceEvent[] = [];

function emptyConsent(): ConsentPreferences {
  return { analytics: false, marketing: false, preferences: false };
}

function consentShape(value: unknown): value is ConsentPreferences {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.analytics === "boolean" && typeof record.marketing === "boolean" && typeof record.preferences === "boolean";
}

export function readStoredConsent(now = Date.now()): StoredConsent | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(CONSENT_KEY) || "null") as Partial<StoredConsent> | null;
    if (!value || !consentShape(value.preferences) || typeof value.expiresAt !== "number" || value.expiresAt <= now || typeof value.updatedAt !== "string") {
      memoryConsent = null;
      return null;
    }
    memoryConsent = value as StoredConsent;
    return memoryConsent;
  } catch {
    return memoryConsent && memoryConsent.expiresAt > now ? memoryConsent : null;
  }
}

export function persistConsent(consent: ConsentPreferences, now = Date.now()): StoredConsent {
  const stored = { preferences: consent, updatedAt: new Date(now).toISOString(), expiresAt: now + CONSENT_TTL };
  memoryConsent = stored;
  try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(stored)); } catch { /* Keep this choice in memory if storage is blocked. */ }
  window.dispatchEvent(new Event("beej:consent-change"));
  return stored;
}

export function captureInitialLanding(config: PublicTrackingConfig): void {
  if (initialTouch !== undefined || typeof window === "undefined") return;
  initialTouch = captureCampaignTouch(window.location.href, document.referrer, config.siteUrl || window.location.origin);
}

function readStoredAttribution(siteUrl: string): AttributionState | null {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ATTRIBUTION_KEY) || "null") as unknown;
    return sanitizeAttributionState(stored, siteUrl);
  } catch {
    return null;
  }
}

function readStoredIdentifiers(): TrackingIdentifiers {
  try {
    const stored = JSON.parse(window.localStorage.getItem(IDENTIFIERS_KEY) || "null") as { value?: unknown; expiresAt?: number } | null;
    if (!stored?.value || typeof stored.expiresAt !== "number" || stored.expiresAt <= Date.now()) return {};
    const value = stored.value as Record<string, unknown>;
    const identifiers: TrackingIdentifiers = {};
    if (typeof value.clientId === "string" && /^\d{1,20}\.\d{1,20}$/.test(value.clientId)) identifiers.clientId = value.clientId;
    if ((typeof value.sessionId === "string" || typeof value.sessionId === "number") && /^\d{1,20}$/.test(String(value.sessionId))) identifiers.sessionId = String(value.sessionId);
    for (const key of ["gclid", "gbraid", "wbraid", "fbclid"] as const) {
      if (typeof value[key] === "string" && value[key].length <= 120 && /^[a-zA-Z0-9._~-]+$/.test(value[key])) identifiers[key] = value[key];
    }
    for (const key of ["fbp", "fbc"] as const) {
      if (typeof value[key] === "string" && value[key].length <= 120 && /^fb\.\d+\.\d+(?:\.[a-zA-Z0-9._~-]+)?$/.test(value[key])) identifiers[key] = value[key];
    }
    return identifiers;
  } catch {
    return {};
  }
}

function saveTrackingIdentifiers(value: TrackingIdentifiers): void {
  try {
    if (Object.keys(value).length) window.localStorage.setItem(IDENTIFIERS_KEY, JSON.stringify({ value, expiresAt: Date.now() + ATTRIBUTION_TTL }));
    else window.localStorage.removeItem(IDENTIFIERS_KEY);
  } catch { /* Denied storage must not block checkout or consent withdrawal. */ }
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!match) return undefined;
  try { return decodeURIComponent(match.slice(name.length + 1)); } catch { return undefined; }
}

function readGoogleIdentifiers(measurementId: string): Promise<{ clientId?: string; sessionId?: string }> {
  const gtag = window.gtag;
  if (!measurementId || typeof gtag !== "function") return Promise.resolve({});
  return new Promise((resolve) => {
    let clientId: string | undefined;
    let sessionId: string | undefined;
    let complete = false;
    const finish = () => {
      if (complete) return;
      complete = true;
      resolve({ ...(clientId ? { clientId } : {}), ...(sessionId ? { sessionId } : {}) });
    };
    const timer = window.setTimeout(finish, 400);
    const receiveClientId = (value: unknown) => {
      if (typeof value === "string" && /^\d{1,20}\.\d{1,20}$/.test(value)) clientId = value;
      if (clientId && sessionId) { window.clearTimeout(timer); finish(); }
    };
    const receiveSessionId = (value: unknown) => {
      if ((typeof value === "string" || typeof value === "number") && /^\d{1,20}$/.test(String(value))) sessionId = String(value);
      if (clientId && sessionId) { window.clearTimeout(timer); finish(); }
    };
    gtag("get", measurementId, "client_id", receiveClientId);
    gtag("get", measurementId, "session_id", receiveSessionId);
  });
}

export async function collectTrackingContext(consent: ConsentPreferences, config: PublicTrackingConfig): Promise<{
  consent: ConsentPreferences;
  attribution?: AttributionState;
  identifiers: TrackingIdentifiers;
}> {
  captureInitialLanding(config);
  const canStoreAttribution = config.enabled && (consent.analytics || consent.marketing);
  const siteUrl = config.siteUrl || window.location.origin;
  let attribution: AttributionState | null = canStoreAttribution ? readStoredAttribution(siteUrl) : null;
  if (canStoreAttribution && initialTouch) {
    attribution = mergeAttribution(attribution, initialTouch);
    if (attribution) {
      try { window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution)); } catch { /* Send this request's in-memory attribution only. */ }
    }
  }

  const identifiers: TrackingIdentifiers = canStoreAttribution ? readStoredIdentifiers() : {};
  if (!consent.analytics) {
    delete identifiers.clientId;
    delete identifiers.sessionId;
  } else {
    Object.assign(identifiers, await readGoogleIdentifiers(config.ga4MeasurementId));
  }
  if (!consent.marketing) {
    delete identifiers.gclid;
    delete identifiers.gbraid;
    delete identifiers.wbraid;
    delete identifiers.fbclid;
    delete identifiers.fbp;
    delete identifiers.fbc;
  } else {
    Object.assign(identifiers, captureClickIdentifiers(window.location.href, document.cookie, true));
  }
  saveTrackingIdentifiers(identifiers);
  return {
    consent,
    ...(attribution ? { attribution } : {}),
    identifiers,
  };
}

export async function syncTrackingContext(consent: ConsentPreferences, config: PublicTrackingConfig): Promise<boolean> {
  try {
    const payload = await collectTrackingContext(consent, config);
    const response = await fetch("/api/tracking/context", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function removeIdentifiersForWithdrawal(consent: ConsentPreferences): void {
  const identifiers = readStoredIdentifiers();
  if (!consent.analytics) {
    delete identifiers.clientId;
    delete identifiers.sessionId;
  }
  if (!consent.marketing) {
    delete identifiers.gclid;
    delete identifiers.gbraid;
    delete identifiers.wbraid;
    delete identifiers.fbclid;
    delete identifiers.fbp;
    delete identifiers.fbc;
  }
  saveTrackingIdentifiers(identifiers);
  if (!consent.analytics && !consent.marketing) {
    initialTouch = null;
    try { window.localStorage.removeItem(ATTRIBUTION_KEY); } catch { /* Storage may be blocked. */ }
  }
}

function consentMode(consent: ConsentPreferences) {
  return {
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    functionality_storage: consent.preferences ? "granted" : "denied",
    personalization_storage: consent.preferences ? "granted" : "denied",
    security_storage: "granted",
  };
}

function loadTagManager(config: PublicTrackingConfig, consent: ConsentPreferences): void {
  if (!config.enabled) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function (...args: unknown[]) { window.dataLayer?.push(args); };
  if (!window.__beejConsentInitialized) {
    window.gtag("consent", "default", consentMode(emptyConsent()));
    window.__beejConsentInitialized = true;
  }
  window.gtag("consent", "update", consentMode(consent));
  if (!config.gtmId || (!consent.analytics && !consent.marketing)) return;
  if (window.__beejGtmLoaded) return;
  window.__beejGtmLoaded = true;
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(config.gtmId)}`;
  script.dataset.beejTracking = "gtm";
  document.head.appendChild(script);
}

export function setTrackingRuntime(next: TrackingRuntime): void {
  runtime = next;
  if (!next.config.enabled) {
    pendingEvents.length = 0;
    return;
  }
  loadTagManager(next.config, next.consent);
  const queued = pendingEvents.splice(0, pendingEvents.length);
  for (const item of queued) emitCommerceEvent(item.event, item.options);
}

function currentLocation(config: PublicTrackingConfig): string {
  const pageUrl = sanitizeTelemetryLocation(window.location.href, config.siteUrl || window.location.origin);
  return pageUrl;
}

function pageReferrerOrigin(): string | undefined {
  try {
    const referrer = new URL(document.referrer);
    return referrer.origin === window.location.origin ? undefined : referrer.origin;
  } catch {
    return undefined;
  }
}

function eventToDataLayer(event: CommerceEvent, config: PublicTrackingConfig, consent: ConsentPreferences): Record<string, unknown> | null {
  const location = currentLocation(config);
  if (event.name === "page_view" && !location) return null;
  const { name, ...details } = event;
  const payload: Record<string, unknown> = {
    ...details,
    event: name,
    page_location: event.name === "page_view" ? location : location || undefined,
    page_referrer: event.name === "page_view" ? pageReferrerOrigin() : undefined,
    beej_analytics_consent: consent.analytics,
    beej_marketing_consent: consent.marketing,
  };
  if ("items" in event) {
    payload.ecommerce = {
      ...(event.currency ? { currency: event.currency } : {}),
      ...(typeof event.value === "number" ? { value: event.value } : {}),
      ...(event.item_list_id ? { item_list_id: event.item_list_id } : {}),
      ...(event.item_list_name ? { item_list_name: event.item_list_name } : {}),
      ...(event.promotion_id ? { promotion_id: event.promotion_id } : {}),
      ...(event.promotion_name ? { promotion_name: event.promotion_name } : {}),
      items: event.items,
    };
    delete payload.items;
    delete payload.currency;
    delete payload.value;
    delete payload.item_list_id;
    delete payload.item_list_name;
    delete payload.promotion_id;
    delete payload.promotion_name;
  }
  for (const [key, value] of Object.entries(payload)) if (value === undefined) delete payload[key];
  return payload;
}

function sendShopifyAnalytics(event: CommerceEvent, options: EmitOptions, active: TrackingRuntime): void {
  if (active.config.mode !== "production" || !active.consent.analytics || !active.shopId) return;
  if (event.name !== "page_view" && event.name !== "add_to_cart") return;
  void import("@shopify/hydrogen-react/analytics").then(({ getClientBrowserParameters, sendShopifyAnalytics: send }) => {
    const browser = getBrowserParams(active.config, getClientBrowserParameters);
    const base = {
      ...browser,
      hasUserConsent: true,
      shopId: active.shopId,
      currency: shopifyCurrency("currency" in event && event.currency ? event.currency : active.currency),
      shopifySalesChannel: "headless" as const,
      analyticsAllowed: true,
      marketingAllowed: active.consent.marketing,
      saleOfDataAllowed: false,
      ...(options.shopifyProducts ? { products: options.shopifyProducts } : {}),
      ...("value" in event && typeof event.value === "number" ? { totalValue: event.value } : {}),
    };
    if (event.name === "page_view") {
      const url = currentLocation(active.config);
      return send({ eventName: "PAGE_VIEW", payload: { ...base, canonicalUrl: url.split("?")[0], pageType: document.body.dataset.pageType || "page", resourceId: document.body.dataset.resourceId || undefined } }, active.config.shopDomain);
    }
    const cartId = options.shopifyCartId?.split("?", 1)[0];
    if (!cartId) return;
    return send({ eventName: "ADD_TO_CART", payload: { ...base, cartId } }, active.config.shopDomain);
  }).catch(() => undefined);
}

function getBrowserParams(config: PublicTrackingConfig, getClientBrowserParameters: () => Record<string, string>) {
  let browser: Record<string, unknown> = {};
  try {
    // Shopify's utility supplies its first-party session tokens. Override URL-derived fields to keep telemetry clean.
    browser = getClientBrowserParameters();
  } catch {
    // The utility can be unavailable in restricted browsers; safe fields below still allow consented Shopify analytics.
  }
  const location = currentLocation(config);
  const parsed = location ? new URL(location) : new URL(window.location.pathname, window.location.origin);
  return {
    ...browser,
    uniqueToken: readCookie("_shopify_y") || "",
    visitToken: readCookie("_shopify_s") || "",
    url: location || `${window.location.origin}${window.location.pathname}`,
    path: parsed.pathname,
    search: parsed.search,
    referrer: pageReferrerOrigin() || "",
    title: document.title.slice(0, 160),
    userAgent: navigator.userAgent.slice(0, 256),
    navigationType: "unknown",
    navigationApi: "PerformanceNavigationTiming",
  };
}

function shopifyCurrency(value: string): CurrencyCode {
  return (/^[A-Z]{3}$/.test(value) ? value : "INR") as CurrencyCode;
}

export function emitCommerceEvent(event: CommerceEvent, options: EmitOptions = {}): void {
  const active = runtime;
  if (!active) {
    if (pendingEvents.length < 50) pendingEvents.push({ event, options });
    return;
  }
  if (!active.config.enabled || !canEmitCommerceEvent(event, active.consent)) return;
  window.dataLayer = window.dataLayer || [];
  loadTagManager(active.config, active.consent);
  const payload = eventToDataLayer(event, active.config, active.consent);
  if (!payload) return;
  window.dataLayer.push(payload);
  sendShopifyAnalytics(event, options, active);
}

export function emitSearch(searchTerm: string, resultCount?: number): void {
  const safeTerm = sanitizeSearchTerm(searchTerm);
  if (!safeTerm) return;
  emitCommerceEvent({ name: "search", search_term: safeTerm, ...(typeof resultCount === "number" ? { result_count: resultCount } : {}) });
}

export async function readAnalyticsIdentifiers(config: PublicTrackingConfig): Promise<{ clientId?: string; sessionId?: string }> {
  return readGoogleIdentifiers(config.ga4MeasurementId);
}

export function createCommerceItem(input: {
  variantId: string;
  title: string;
  price: string;
  quantity?: number;
  brand?: string;
  category?: string;
  variant?: string;
  listName?: string;
  index?: number;
}) {
  const itemId = makeVariantTrackingId(input.variantId);
  const price = Number(input.price);
  const quantity = input.quantity ?? 1;
  if (!itemId || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  return {
    item_id: itemId,
    item_name: input.title.slice(0, 160),
    ...(input.brand ? { item_brand: input.brand.slice(0, 80) } : {}),
    ...(input.category ? { item_category: input.category.slice(0, 80) } : {}),
    ...(input.variant ? { item_variant: input.variant.slice(0, 80) } : {}),
    price,
    quantity,
    ...(input.listName ? { item_list_name: input.listName.slice(0, 80) } : {}),
    ...(typeof input.index === "number" ? { index: input.index } : {}),
  };
}

export function createShopifyAnalyticsProduct(input: ShopifyProduct): ShopifyProduct | null {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(input.productGid) || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(input.variantGid)) return null;
  if (!Number.isFinite(Number(input.price)) || !Number.isSafeInteger(input.quantity) || input.quantity < 1) return null;
  return input;
}

export function getCurrentConsent(): ConsentPreferences {
  return runtime?.consent || emptyConsent();
}

export function buildAttributionForStorage(config: PublicTrackingConfig): AttributionState | null {
  captureInitialLanding(config);
  const siteUrl = config.siteUrl || window.location.origin;
  if (initialTouch) return mergeAttribution(readStoredAttribution(siteUrl), initialTouch);
  return readStoredAttribution(siteUrl);
}
