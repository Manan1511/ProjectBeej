# Cashfree Direct Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sandbox-only direct Cashfree hosted checkout for bag and Buy Now, with Shopify-calculated totals and verified, idempotent Shopify test orders.

**Architecture:** Keep Shopify as catalog and order authority. The server quotes delivery and totals through Shopify, persists a draft order, creates a Cashfree sandbox payment session from that quote, then verifies return/webhook payment state before creating a test order and reconciling the draft. Use Cashfree's hosted JS checkout, raw-body HMAC verification, and Shopify compare-digest plus `sourceIdentifier` recovery for idempotency.

**Tech Stack:** Next.js 16 App Router route handlers and server-only environment variables; Shopify Storefront and Admin GraphQL APIs; Cashfree Payments API version `2026-01-01`; Cashfree Checkout JS v3; Vitest; existing project rate-limit, cart-cookie, and keyed-lock utilities.

**Spec:** `docs/superpowers/specs/2026-10-27-cashfree-direct-checkout.md`

## Global Constraints

- Use only Cashfree sandbox credentials and `https://sandbox.cashfree.com/pg`.
- Never accept a price, shipping cost, tax, discount, or paid status from browser input.
- Keep Cashfree credentials server-only and never inspect or commit `APIKey.csv`.
- Preserve the saved bag during Buy Now and retain carts for failed or pending payment.
- Shopify test orders use `test: true` and `inventoryBehaviour: BYPASS`.
- Continue using Shopify's delivery options, discounts, tax calculation, and order records.
- Keep payment routes private/no-store and verify Cashfree webhooks using their raw request body.
- Preserve unrelated existing workspace changes; stage only payment files if a commit is made.
- Do not add production Cashfree mode, publish, or push.

## Review Focus

- Browser amount or delivery option tampering: the server reloads Shopify cart and validates the selected live delivery option before creating a quote.
- Cart changes after quote creation: payment remains bound to the persisted Shopify draft snapshot, not later cart state.
- Payment return or duplicate webhook race: source-identifier recovery and compare-digest claiming produce one Shopify order.
- Sandbox payment against the connected Shopify store: the created Shopify order is marked test and does not claim inventory.
- Cashfree timeout after order creation: retry the same Cashfree order ID/idempotency key and reconcile before creating a second session.

---

### Task 1: Cashfree sandbox client and signature primitives

**Files:**
- Create: `src/lib/cashfree-core.ts`
- Create: `src/lib/cashfree-core.test.ts`
- Create: `src/lib/cashfree.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces `getCashfreeConfig(env = process.env): CashfreeConfig | null`, `createCashfreeOrder(input): Promise<CashfreeOrderSession>`, `getCashfreeOrder(orderId): Promise<CashfreeOrder>`, `getCashfreePayments(orderId): Promise<CashfreePayment[]>`, and `verifyCashfreeWebhook(rawBody, timestamp, signature, secret): boolean`.
- The API wrapper imports `server-only`; the pure core accepts injected `fetch` and environment for deterministic tests.
- Sandbox mode uses `https://sandbox.cashfree.com/pg`, `x-api-version: 2026-01-01` by default, `x-client-id`, and `x-client-secret`.

- [ ] **Step 1: Write tests first**
  - `uses the sandbox host and API version with server credentials`
  - `keeps the create-order amount and metadata from the trusted server input`
  - `reuses the same idempotency key after a create-order timeout`
  - `rejects production configuration and missing credentials`
  - `verifies Base64 HMAC-SHA256 over timestamp plus raw body`
  - `rejects altered raw bodies, timestamps, and signatures`
- [ ] **Step 2: Run `npx vitest run src/lib/cashfree-core.test.ts` and confirm the expected missing-export failures.**
- [ ] **Step 3: Implement the pure request/config/signature functions and the server-only Cashfree API wrapper.**
- [ ] **Step 4: Run `npx vitest run src/lib/cashfree-core.test.ts` and confirm all tests pass.**

### Task 2: Shopify delivery quoting and durable payment draft

**Files:**
- Modify: `src/lib/storefront.ts`
- Modify: `src/lib/types.ts`
- Create: `src/lib/cashfree-shopify.ts`
- Create: `src/lib/cashfree-shopify.test.ts`
- Modify: `docs/SHOPIFY_SETUP.md`

**Interfaces:**
- Produces `getCashfreeDeliveryOptions(cartId, buyer, address): Promise<DeliveryOption[]>`, `createCashfreeDraftQuote(input): Promise<CashfreeDraftQuote>`, and `readCashfreeDraftQuote(draftOrderId): Promise<CashfreeDraftQuote | null>`.
- Quote creation reloads the Shopify cart, applies address and delivery-option state through Storefront API, calculates the matching Admin draft order, and rejects empty carts, stale delivery handles, non-INR totals, or mismatched cart/draft totals.
- A draft stores the one-time checkout order ID and a compare-digest state metafield; Shopify draft data is the durable cart/amount snapshot.

- [ ] **Step 1: Write tests first**
  - `returns only delivery options from the current cart and shipping address`
  - `rejects a stale or unknown delivery option handle`
  - `calculates a draft quote from Shopify line items and selected shipping`
  - `rejects cart/draft total or currency mismatch`
  - `persists the Cashfree order reference and initial state on the draft`
- [ ] **Step 2: Run `npx vitest run src/lib/cashfree-shopify.test.ts` and confirm expected missing-function failures.**
- [ ] **Step 3: Add delivery-group query/mutations and Admin draft-order quote/store operations.**
- [ ] **Step 4: Run `npx vitest run src/lib/cashfree-shopify.test.ts src/lib/storefront.test.ts` and confirm all tests pass.**
- [ ] **Step 5: Document `write_draft_orders` and `write_orders` scope changes and sandbox-only setup in `docs/SHOPIFY_SETUP.md`.**

### Task 3: Checkout page, buyer address, and session creation

**Files:**
- Create: `src/app/(storefront)/checkout/page.tsx`
- Create: `src/components/CashfreeCheckout.tsx`
- Create: `src/app/api/payments/cashfree/shipping-options/route.ts`
- Create: `src/app/api/payments/cashfree/create-order/route.ts`
- Create: `src/lib/cashfree-checkout-handler.ts`
- Create: `src/lib/cashfree-checkout-handler.test.ts`
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/components/ProductDetail.tsx`
- Modify: `src/app/api/buy-now/route.ts`

**Interfaces:**
- `POST /api/payments/cashfree/shipping-options` accepts buyer/address fields only and returns Shopify delivery choices and server-calculated totals.
- `POST /api/payments/cashfree/create-order` accepts the validated buyer/address and selected delivery handle, creates the Shopify draft and Cashfree order, and returns only `orderId`, `paymentSessionId`, and sandbox mode.
- Bag checkout navigates to `/checkout`; Buy Now creates an independent cart and uses a separate HttpOnly cookie so the existing bag remains untouched.
- The checkout client loads Cashfree Checkout JS v3 and invokes it with `paymentSessionId`; no amount or Cashfree credentials are serialized.

- [ ] **Step 1: Write handler/component tests first**
  - `rejects cross-origin and malformed quote/session requests`
  - `ignores client prices and derives the Cashfree amount from the Shopify draft`
  - `requires an available selected delivery option and INR quote`
  - `returns no secret fields in the browser session payload`
  - `keeps the saved cart cookie unchanged for Buy Now`
- [ ] **Step 2: Run `npx vitest run src/lib/cashfree-checkout-handler.test.ts` and confirm expected missing-handler failures.**
- [ ] **Step 3: Implement the private routes, checkout form, sandbox SDK invocation, and bag/Buy Now navigation.**
- [ ] **Step 4: Run `npx vitest run src/lib/cashfree-checkout-handler.test.ts src/components/CartPanel.test.tsx src/app/api/storefront-preview.test.ts` and confirm all tests pass.**

### Task 4: Webhook, return verification, and Shopify test-order finalization

**Files:**
- Create: `src/app/api/webhooks/cashfree/route.ts`
- Create: `src/app/api/payments/cashfree/status/route.ts`
- Create: `src/lib/cashfree-finalization.ts`
- Create: `src/lib/cashfree-finalization.test.ts`
- Create: `src/app/(storefront)/checkout/result/page.tsx`
- Modify: `src/components/cart-coordinator.ts`

**Interfaces:**
- `POST /api/webhooks/cashfree` validates size, required headers, raw-body signature, payload, and then independently fetches the order/payment state from Cashfree.
- `GET /api/payments/cashfree/status?order_id=...` requires a signed shopper session cookie, fetches authoritative Cashfree state, and reconciles a paid order. Return-query flags are never treated as payment proof.
- `finalizeCashfreePayment(orderId): Promise<"paid" | "pending" | "failed">` verifies order tags, draft amount/currency, and a successful payment; atomically claims the draft with compare-digest state; queries Shopify by `source_identifier` before any retry; creates one `test: true` Shopify order with the Cashfree transaction ID and `inventoryBehaviour: BYPASS`; then marks the draft complete.
- A successful result clears only the relevant saved or Buy Now cart; pending, failed, or mismatched states do not clear it.

- [ ] **Step 1: Write tests first**
  - `rejects a missing or invalid Cashfree webhook signature`
  - `does not finalize pending, failed, wrong-amount, or wrong-currency payments`
  - `creates a Shopify test order only after a Cashfree success is independently verified`
  - `uses test transactions and inventory bypass in sandbox`
  - `recovers the existing Shopify order by source identifier after an ambiguous write`
  - `makes duplicate webhook and return processing idempotent`
  - `keeps carts intact on pending, failure, and finalization error`
- [ ] **Step 2: Run `npx vitest run src/lib/cashfree-finalization.test.ts` and confirm expected missing-function failures.**
- [ ] **Step 3: Implement finalization, status checks, signed return cookie, and webhook route.**
- [ ] **Step 4: Run `npx vitest run src/lib/cashfree-finalization.test.ts src/lib/tracking-webhook-handler.test.ts` and confirm all tests pass.**

### Task 5: Full verification and setup handoff

**Files:**
- Modify: `docs/SHOPIFY_SETUP.md`
- Modify: `.env.example`
- Verify: payment routes, cart, Buy Now, and storefront pages

- [ ] Run `npm test`; expected: all tests pass.
- [ ] Run `npm run typecheck`; expected: all TypeScript projects pass.
- [ ] Run `npm run lint`; expected: no lint errors.
- [ ] Run `git diff --check`; expected: no whitespace errors.
- [ ] Run `npm run build`; expected: production build succeeds.
- [ ] Review the final scoped diff and confirm no key material or unrelated files are staged.
- [ ] Document local sandbox variable names, Shopify scopes, Cashfree webhook URL, and the fact that automated verification does not make a Cashfree request.

**Ruling:** Keep the user's current `APIKey.csv` out of inspection and source changes. The checkout supports keys through ignored `.env.local` variables so credentials remain private; cost if wrong is that the user must copy the keys into local/server settings manually.
