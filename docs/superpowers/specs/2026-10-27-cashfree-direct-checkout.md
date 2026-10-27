# Cashfree Direct Checkout Design

## Goal

Add a Cashfree hosted checkout using sandbox credentials while keeping Shopify authoritative for the catalog, customer-selected shipping, discounts, taxes, and order records.

## User-selected direction

The user selected **direct Cashfree API checkout**. This replaces the current Shopify-hosted payment step for the bag and Buy Now flows. It does not use Cashfree's Shopify payment-provider plugin.

## Checkout contract

1. The checkout page collects buyer name, email, phone, and one Indian delivery address. It loads the current Shopify cart from the server; browser-submitted prices and totals are never trusted.
2. Shopify Storefront API provides the address-specific delivery options. The buyer selects one, and the server recalculates the cart and a Shopify draft-order quote with the current line items, available discounts, shipping choice, and tax rules.
3. A Shopify draft order persists the exact quote before payment. The server creates a Cashfree order for the quoted INR total and stores the draft-order ID in Cashfree order metadata. Only the Cashfree `payment_session_id` reaches the browser.
4. Cashfree Checkout JS opens its hosted payment experience. The app never receives card, UPI PIN, or other payment credentials.
5. A Cashfree return URL is only a navigation signal. A signed Cashfree webhook or server-side order-status check must verify the payment with Cashfree, match order ID, amount, currency, and a successful payment transaction, and reconcile it to the Shopify draft before creating the Shopify order.
6. The Shopify order carries a unique Cashfree source identifier and transaction reference. A compare-digest claim on the persisted Shopify draft plus source-identifier recovery prevents duplicate order creation across webhook/return races.
7. Since the available keys are test keys, created Shopify orders are explicitly marked `test: true`; inventory behavior is `BYPASS`. Pending or failed payments do not clear the shopper's bag. Successful payment clears only the cart used by that checkout. Buy Now uses an independent cart and must not replace the saved bag.

## Environment and access

- Cashfree is sandbox-only in this implementation. Use server-only `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY`, plus `CASHFREE_API_VERSION=2026-01-01` and `CASHFREE_ENVIRONMENT=sandbox`.
- Cashfree secrets stay out of source, `.env.example` values, the browser bundle, logs, and HTTP responses. Use `.env.local` for development or a server environment-variable manager for deployment. Do not read, stage, or copy `APIKey.csv`.
- Shopify Admin app access must be expanded only for the order workflow: `write_draft_orders`, `write_orders`, and the existing order read scope used to recover orders by `source_identifier`.
- Payment, return, quote, and webhook responses use private no-store cache headers. Webhook signatures are checked against the untouched raw request body and timestamp using HMAC-SHA256 and Base64.
- Neither publishing nor a live transaction is part of this work. There is no production Cashfree mode.

## Failure behavior

- Missing sandbox credentials keep the current checkout path available and do not break the storefront.
- Expired carts, invalid addresses, unavailable shipping options, Shopify/Cashfree outages, amount mismatches, bad signatures, and pending/failed payment statuses return retryable states without clearing the bag or creating an order.
- Payment verification and Shopify order creation are idempotent. Repeated webhooks and customer return polling resolve to the same order.
- Ambiguous Cashfree order-create timeouts are resolved using the same server-generated order ID/idempotency key before attempting another create.

## Verification

- Unit tests cover Cashfree request configuration, API failures, webhook signature validation, shipping quote validation, amount/currency matching, order-create idempotency/recovery, and cart preservation.
- Route tests cover same-origin checkout mutations, sandbox-only behavior, private caching, unauthenticated/malformed webhook rejection, pending/failed/paid states, and duplicate delivery.
- Run the full Vitest suite, lint, typecheck, `git diff --check`, and production build. No real Cashfree requests or order writes are performed by automated tests.
- Sandbox end-to-end verification requires the user to place test credentials in `.env.local`, install the added Shopify Admin scopes, and configure a public HTTPS webhook URL for the deployed preview/test environment. No secret values are needed in chat.
