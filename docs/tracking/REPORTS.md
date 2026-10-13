# Ecommerce reporting setup

## GA4

Build these explorations after the production stream and consented GTM events are validated:

- **Acquisition:** first-user and session source/medium/campaign, new users, sessions, engaged sessions, product views, add-to-cart, checkout and paid purchase.
- **Shopping funnel:** `view_item` → `add_to_cart` → `begin_checkout` → Shopify checkout shipping/payment milestones → server `purchase`. Segment by product, variant, device and campaign.
- **Product:** item views, add-to-cart rate, purchases, discounted merchandise revenue and item quantity using `beej_<variant id>`.
- **Search:** submitted term and result count, including zero-result searches. Search terms are length-limited and contact details are discarded.
- **Lead/contact:** newsletter signup, WhatsApp click and email click. Newsletter counts only after the explicit email opt-in succeeds.
- **Performance:** consented Web Vitals distribution. Treat this as opt-in lab-like telemetry; Core Web Vitals field assessment belongs in Search Console/CrUX.

`checkout_completed_diagnostic` is a checkout-flow diagnostic, not a purchase or revenue event. Do not import it into Ads as a conversion.

## Google Ads

Link the correct Google Ads account and GA4 property after access is approved. Import the paid GA4 purchase as the sole Primary bidding action. Keep add-to-cart, begin-checkout, newsletter and contact events Secondary. Inspect conversion diagnostics and deduplicate any existing native Shopify or Google purchase tags before enabling bids.

## Meta

Connect the same production dataset used by the browser Pixel and CAPI. Validate deduplication, event match quality, consent gating and purchase value in Test Events, then review Events Manager diagnostics. Do not configure email/phone matching in this release.

## Revenue interpretation

Shopify reports paid, refunded and net revenue and is the financial authority. GA4 and Meta use platform attribution models and will not equal Shopify. GA4 refund events are reported; this release does not retract Meta or Google Ads attributed conversions after refunds. Show the two figures side by side and label each source.
