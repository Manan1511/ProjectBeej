# Project Beej tracking and launch setup

## Current state

The code is ready for configuration, but tracking stays **off** by default. No GTM, GA4, Meta, Supabase, or Shopify Admin credentials are included in this repository. Product feeds return 404 outside the production deploy context and use only published Shopify catalogue data. Checkout uses Shopify's latest cart state and Shopify remains the source of truth.

The following items need merchant-owned accounts and access before activation: the production domain, GA4 stream and GTM container, Meta dataset and CAPI token, a separate Supabase Free project, a Shopify app with the stated scopes, approved product identifiers, and the Shopify checkout-origin list. The previously shared Shopify private token should be rotated before launch.

## Environment variables

Copy `.env.example` to `.env.local` for local work. Put production and test secrets in the corresponding Netlify contexts. Never add real values to source control.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_TRACKING_MODE` | `off` by default; `test` uses only test IDs; `production` is enabled only in Netlify's production context. |
| `NEXT_PUBLIC_GTM_ID` | Brand-owned production GTM container ID. |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Production GA4 web stream ID. |
| `NEXT_PUBLIC_META_PIXEL_ID` | Production Meta dataset/pixel ID. |
| `NEXT_PUBLIC_TEST_GTM_ID`, `NEXT_PUBLIC_TEST_GA4_MEASUREMENT_ID`, `NEXT_PUBLIC_TEST_META_PIXEL_ID` | Isolated test identifiers. |
| `GA4_API_SECRET`, `GA4_TEST_API_SECRET` | Server-only GA4 Measurement Protocol secrets. |
| `META_CAPI_ACCESS_TOKEN`, `META_TEST_CAPI_ACCESS_TOKEN` | Server-only Meta CAPI tokens. |
| `META_CAPI_VERSION`, `META_TEST_CAPI_VERSION` | Explicit Graph API versions approved for the Meta app. |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Separate tracking project URL and server-only secret key. Do not use the currently connected Supabase account. |
| `TRACKING_SIGNING_SECRET` | Random server secret, at least 32 characters; used for signed checkout context and private rate-limit keys. |
| `SHOPIFY_TRACKING_WEBHOOK_SECRET` | Shopify webhook signing secret for the dedicated tracking webhook subscription. |
| `SHOPIFY_TRACKING_ADMIN_ACCESS_TOKEN` | Dedicated server-only token with `read_orders`; request approved `read_all_orders` only if older refund reconciliation is needed. |
| `SHOPIFY_NEWSLETTER_ADMIN_ACCESS_TOKEN` | Separate server-only app token with the minimum customer-write access needed for explicit newsletter opt-in. |
| `SITE_URL`, `NEXT_PUBLIC_SITE_URL` | Final HTTPS canonical origin, set to the same origin. |
| `SHOPIFY_CHECKOUT_ORIGINS` | Comma-separated HTTPS checkout origins when Shopify checkout uses a host different from the storefront or `myshopify.com` domain. |
| `SHOPIFY_MODE` | Keep `preview` until published catalogue, checkout and policies are approved; use `live` only for production. |

The Storefront token stays server-side. The public storefront token is not a substitute for an Admin credential. Keep each Shopify app/token separate so a newsletter permission cannot silently grant order access.

## Separate Supabase project

1. Create a new Free Supabase project in the merchant's own account and record its region for the privacy notice.
2. Install or use the Supabase CLI locally. Link only this new project, review the migration, then apply `supabase/migrations/20261013155947_ecommerce_tracking.sql` with `supabase db push`.
3. Confirm RLS is enabled and `anon`/`authenticated` cannot read or write tracking tables or execute the service functions. The storefront uses only `SUPABASE_SECRET_KEY` on the server.
4. Run the migration checks and verify the private tables, unique delivery/event constraints, consent reduction functions, rate limiting, leases and cleanup procedure in that project.
5. Do not paste the service secret into the browser, a GTM variable, a Shopify pixel, or a public issue.

No Supabase project is linked by this source tree. Remote migrations and database checks remain an activation task for that separate account.

## Shopify setup

1. Create a dedicated tracking app. Configure `orders/paid` and `refunds/create` webhooks to `https://YOUR_FINAL_DOMAIN/api/webhooks/shopify/tracking`, using the raw-body HMAC secret stored as `SHOPIFY_TRACKING_WEBHOOK_SECRET`.
2. Configure the tracking Admin token with `read_orders`. Shopify restricts orders to the last 60 days by default; request `read_all_orders` only for an approved older-refund use case.
3. Create a different newsletter app with only the customer permissions needed to upsert an address and record marketing consent. Store its token as `SHOPIFY_NEWSLETTER_ADMIN_ACCESS_TOKEN`.
4. In `Settings → Customer events`, create a Custom Pixel from `docs/tracking/shopify-checkout-pixel.js`. Replace its `SITE_ORIGIN` placeholder with the final HTTPS origin. Add the actual Shopify checkout host to `SHOPIFY_CHECKOUT_ORIGINS` if needed.
5. Set the pixel privacy requirement to **Not required** so its consent-reduction listener also receives marketing-only and withdrawal changes. The code gates analytics itself, and no checkout purchase is sent from this pixel.
6. In a test shop, verify checkout start, shipping, payment and completed-diagnostic events. Confirm `checkout_completed_diagnostic` has no transaction ID and does not create a purchase. Disable old checkout purchase tags before enabling server-side purchase reporting.

The custom pixel uses Shopify's documented customer privacy event and cart attributes. Shopify's initial checkout cart snapshot exposes attributes only on stores upgraded to Checkout Extensibility. If that snapshot is unavailable, the checkout pixel intentionally sends no analytics event.

## GTM and provider activation

Use one brand-owned GTM container on the storefront and configure it to consume the `dataLayer` contract in `src/lib/tracking-events.ts` and `src/lib/tracking-client.ts`.

- Keep GA4 automatic page-view, browser-history, form and site-search collection off. The storefront emits page views on route change and submitted search events explicitly.
- Gate GA4 tags on `beej_analytics_consent`; gate Meta tags on `beej_marketing_consent`. Do not install an additional native Shopify/Meta/Google purchase integration during this rollout.
- Configure the same GA4 stream ID in the storefront, checkout bridge and server Measurement Protocol pipeline.
- Use Shopify `orders/paid` as the only purchase source. GA4 purchase and Meta CAPI purchase are sent server-side after a paid order and valid signed tracking context. GA4 `refund` covers completed full or partial merchandise refunds; advertising-platform refund retractions are out of scope.
- Link Google Ads to GA4 and import the paid GA4 purchase as the **only Primary** bidding conversion. Keep cart, checkout, newsletter and contact events Secondary.
- Use the same Meta dataset/pixel ID for consented browser events and CAPI. Verify CAPI event IDs in Meta Test Events before production.
- Do not use email/phone matching, session replay, fingerprinting, or consent-denied pings.

No importable branded GTM container is included: the brand's GTM/GA4/Meta IDs do not exist in the project yet. Build the container in the merchant-owned GTM account from this event contract, export it after IDs and consent rules are reviewed, then store that export with launch records.

## Scheduled recovery

Netlify deploys three standard functions: request handlers for context/checkout consent/newsletter/webhooks, a 15-minute outbox/refund recovery function, and a daily recent-order/refund reconciliation function. The worker caps each provider batch at four and parallelism at two, rechecks consent before delivery, and uses bounded retries. GA4 refund requests with ambiguous delivery go to manual review to avoid duplicate financial events.

Review Netlify function logs for status/counts only. Do not log request bodies, provider payloads, cookies, tokens, email addresses, IP addresses, or checkout URLs. Failed Supabase writes return an error to Shopify so webhook deliveries can retry.

## UTM naming

Follow [`UTM_NAMING.md`](./UTM_NAMING.md). Use stable lowercase values and never put a name, phone number, email address, order ID, or other customer information in a URL.

## SEO and feeds

- Set the final HTTPS domain in `SITE_URL` and `NEXT_PUBLIC_SITE_URL`; configure the preferred domain and HTTPS redirect in Netlify and DNS.
- Publish Shopify SEO titles/descriptions, product SKUs, verified GTINs, prices and stock. Previews/cart/search remain noindex.
- Verify `/sitemap.xml`, `/robots.txt`, `/feeds/products.xml`, and `/feeds/meta.csv` only after the production domain and Shopify live catalogue are configured.
- Add the XML feed to Google Merchant Center and the CSV feed to Meta Commerce Manager. Product IDs use `beej_<numeric Shopify variant ID>` and product links include `?variant=<numeric ID>`.
- Check structured data and actual feed price/availability against Shopify. A Shopify outage returns `503`; the feed never substitutes preview prices or guessed stock.
- Use Search Console, Merchant Center diagnostics, GA4 DebugView, Meta Test Events and Google's rich-result tester before launch.

## Reports

Use [`REPORTS.md`](./REPORTS.md) for acquisition, funnel, product, search and lead reporting. Keep Shopify net revenue as the accounting source of truth and report GA4/Meta revenue as attributed platform outcomes, not ledger totals.

## Safe activation and rollback

1. Keep tracking mode `off` until consent, database, DNS, webhook signatures, test IDs and privacy copy are verified.
2. Turn on `test` only with test destinations and deploy-preview credentials. Complete rejection, analytics-only, marketing-only, withdrawal, cart, Buy Now, checkout, cancelled payment and test refund checks.
3. Review production consent and provider payloads with the merchant, then configure production IDs/secrets in the Netlify production context. Do not enable a test destination or deploy-preview ID in production.
4. Run one controlled live payment/refund only after the merchant authorizes the transaction and confirms dispatch is prevented. Confirm Shopify payment state first, then GA4/Meta receipt and refund status.
5. To roll back, set `NEXT_PUBLIC_TRACKING_MODE=off`, rebuild/redeploy, disable the Shopify custom pixel and tracking webhooks, and revoke/rotate provider and Shopify tracking credentials as needed. Shopping, cart and Shopify checkout continue to work without analytics services.

Production activation is intentionally incomplete while merchant IDs, domain, app permissions, separate Supabase project, verified identifiers and approved legal/contact details are missing.
