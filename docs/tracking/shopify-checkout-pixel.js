// Paste into Shopify Admin > Settings > Customer events > Add custom pixel.
// Set this pixel's Shopify privacy requirement to "Not required" so the essential
// consent reduction listener also runs for marketing-only visitors. This script
// gates analytics events itself and never sends purchase conversions.
const SITE_ORIGIN = "https://YOUR_FINAL_DOMAIN";

const cartAttributes = init.data.cart?.attributes || [];
const contextCapability = cartAttributes.find((attribute) => attribute.key === "beej_tracking_context")?.value;
let privacy = init.customerPrivacy;
const sentEvents = new Set();

function currentConsent(value) {
  return {
    analytics: value?.analyticsProcessingAllowed === true,
    marketing: value?.marketingAllowed === true,
    preferences: value?.preferencesProcessingAllowed === true,
  };
}

function syncConsent(value) {
  if (!contextCapability) return;
  fetch(`${SITE_ORIGIN}/api/tracking/checkout-consent`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capability: contextCapability, consent: currentConsent(value) }),
  }).catch(() => undefined);
}

function sendCheckoutEvent(event) {
  if (!contextCapability || privacy?.analyticsProcessingAllowed !== true || !event.id || sentEvents.has(event.id)) return;
  sentEvents.add(event.id);
  const allowedNames = new Set(["checkout_started", "checkout_shipping_info_submitted", "payment_info_submitted", "checkout_completed"]);
  if (!allowedNames.has(event.name)) return;
  fetch(`${SITE_ORIGIN}/api/tracking/checkout-event`, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capability: contextCapability, eventId: event.id, name: event.name }),
  }).catch(() => undefined);
}

syncConsent(privacy);
customerPrivacy.subscribe("visitorConsentCollected", (event) => {
  privacy = event.customerPrivacy;
  // Consent reduction sync is essential and does not depend on analytics permission.
  syncConsent(privacy);
});

for (const eventName of ["checkout_started", "checkout_shipping_info_submitted", "payment_info_submitted", "checkout_completed"]) {
  analytics.subscribe(eventName, sendCheckoutEvent);
}
