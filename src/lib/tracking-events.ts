import type { ConsentPreferences } from "@/lib/tracking-types";

export type CommerceItem = {
  item_id: string;
  item_name: string;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
  item_list_name?: string;
  index?: number;
};

type EcommerceEventName = "view_item_list" | "select_item" | "view_item" | "view_cart" | "add_to_cart" | "remove_from_cart" | "begin_checkout" | "view_promotion" | "select_promotion";
type AnalyticsOnlyEventName = "page_view" | "search" | "newsletter_signup" | "whatsapp_click" | "email_click" | "web_vital" | "commerce_error" | "checkout_completed_diagnostic";

export type CommerceEvent =
  | { name: "page_view"; page_location: string; page_referrer?: string; page_title?: string }
  | { name: "search"; search_term: string; result_count?: number }
  | { name: "newsletter_signup"; method: "email" }
  | { name: "whatsapp_click" | "email_click"; link_domain: string }
  | { name: "web_vital"; metric_name: "CLS" | "FCP" | "INP" | "LCP" | "TTFB"; value: number; metric_id: string }
  | { name: "commerce_error"; action: "add_to_cart" | "buy_now" | "checkout" | "cart_update" | "newsletter_signup"; status_code?: number }
  | { name: "checkout_completed_diagnostic"; currency: string; value: number; transaction_id?: string }
  | { name: EcommerceEventName; currency?: string; value?: number; items: CommerceItem[]; item_list_id?: string; item_list_name?: string; promotion_id?: string; promotion_name?: string };

const ANALYTICS_ONLY = new Set<AnalyticsOnlyEventName>([
  "page_view", "search", "newsletter_signup", "whatsapp_click", "email_click", "web_vital", "commerce_error", "checkout_completed_diagnostic",
]);
const CONTACT_DATA = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:\+?\d[\d\s().-]{6,}\d)/i;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_id", "utm_content", "utm_term"] as const;

export function canEmitCommerceEvent(event: CommerceEvent, consent: ConsentPreferences): boolean {
  return ANALYTICS_ONLY.has(event.name as AnalyticsOnlyEventName) ? consent.analytics : consent.analytics || consent.marketing;
}

export function makeVariantTrackingId(variantId: string): string | null {
  const numericId = /^(?:gid:\/\/shopify\/ProductVariant\/)?(\d+)$/.exec(variantId)?.[1];
  return numericId ? `beej_${numericId}` : null;
}

export function sanitizeTelemetryLocation(value: string, siteOrigin: string): string {
  try {
    const url = new URL(value, siteOrigin);
    const origin = new URL(siteOrigin).origin;
    if (url.origin !== origin || url.username || url.password || url.pathname === "/api" || url.pathname.startsWith("/api/")) return "";
    const safeUrl = new URL(url.pathname.replace(/[\u0000-\u001f\u007f]/g, ""), origin);
    for (const key of UTM_KEYS) {
      const raw = url.searchParams.get(key);
      if (!raw) continue;
      const sanitized = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
      if (sanitized && !CONTACT_DATA.test(sanitized)) safeUrl.searchParams.set(key, sanitized);
    }
    return safeUrl.toString();
  } catch {
    return "";
  }
}
