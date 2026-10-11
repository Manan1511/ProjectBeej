# Launch and support runbook

## Launch readiness

Complete every item before opening live purchases:

- [ ] Rotate the private token shared during setup. Create or confirm separate least-scope credentials for Storefront API and newsletter Admin API access.
- [ ] Publish the five approved products to Headless. Verify handles, collections, variants, pack sizes, prices, SKUs, stock, images, and product facts.
- [ ] Complete and approve the Privacy, Refund, and Terms policies, About page, contact email, WhatsApp link, and social links.
- [ ] Confirm Shopify India market/currency, tax configuration, merchant-managed shipping zones and rates, and dispatch capacity. Set `SHOPIFY_SHIPPING_CONFIGURED=1` only after the configured rates match the merchant’s approved shipping policy.
- [ ] Install and activate Razorpay Secure in Shopify checkout. Leave COD disabled.
- [ ] Confirm GoDaddy Node.js Hosting is set to Node 22 with `npm run build`, `npm start`, the assigned `PORT`, and `0.0.0.0` binding.
- [ ] Set server-side production variables, including `SHOPIFY_MODE=live`, Storefront token, the separate Admin token if newsletter signup is enabled, `SITE_URL` with the final HTTPS origin, and exact verified checkout hostnames only.
- [ ] Configure the domain, HTTPS/SSL, and preferred-host/HTTP-to-HTTPS redirects. Keep `.env.local` out of uploads and source control.
- [ ] Capture the current GoDaddy deployment/version and environment-variable names for rollback. Never include token values in the record.

## Acceptance walkthrough

Use a merchant-approved test method and prevent test orders from reaching dispatch:

1. Load the HTTPS site on desktop and mobile. Confirm logo, supplied assets, homepage sections, policy links, canonical domain, and no missing images.
2. Search for products and browse each collection. Confirm no unpublished product appears.
3. Open a product, select each variant, change quantity, and check stock limits and unavailable states.
4. Add to cart, update quantity, remove a line, refresh, and confirm the private cart recovers. Confirm shipping estimate behavior against the configured Shopify rate.
5. Use Buy Now and verify it starts a separate checkout without replacing the saved cart.
6. Follow the Shopify checkout to the merchant-approved payment test. Verify success, failure, cancel, and retry behavior. In Shopify Admin, confirm the resulting order, payment state, total, inventory change, and fulfillment status.
7. Submit a newsletter test only with an approved test address and the separate Admin token. Confirm customer marketing consent is recorded; confirm the endpoint reports a configuration error when the Admin integration is unavailable.
8. If a live payment/refund test is required, get the merchant’s transaction authorization first and ensure nobody dispatches the test order.

## Release and rollback

1. Deploy to a protected preview host first. Run the acceptance walkthrough and review server logs for secrets, checkout errors, and failed Shopify requests.
2. Only after the merchant approves the preview, deploy the verified build to the production GoDaddy app. Check HTTPS, redirects, all routes, Shopify checkout, and the GoDaddy-assigned port.
3. Record the deployment identifier and time. Keep the previous known-good build available.
4. For a code or host regression, redeploy the previous known-good build and verify the storefront and checkout routes. Keep the same validated server environment unless the incident requires credential rotation.
5. For an urgent checkout outage, set `SHOPIFY_MODE=preview` to disable purchase actions while showing a clearly marked, non-purchasable design preview. Fix the cause, validate checkout again, and return to `SHOPIFY_MODE=live` only after confirmation.
6. Do not delete Shopify orders or issue a refund as part of a code rollback. Resolve each affected order in Shopify Admin with the merchant.

## Post-launch support triage

Record the time, affected URL, device/browser, product/variant, Shopify order number if one exists, last successful step, and a redacted error message. Never include tokens, full payment data, or customer address in a support ticket.

- **P1 — checkout or payment failure, wrong charged total, or order/payment mismatch:** alert the merchant promptly, pause purchase actions using the preview switch if needed, check GoDaddy and Shopify/Razorpay status, and reconcile the Shopify order before retrying.
- **P2 — one product, collection, or content issue:** verify product publication, stock, metafield JSON, image URL, and product handle in Shopify; correct the source data and reload the storefront.
- **P3 — copy/layout issue without purchase impact:** capture the affected viewport and URL, check whether it comes from Shopify-managed content or the deployed build, then schedule the smallest fix.

After resolution, verify the original flow and one neighboring route, record the cause and fix, and ask the merchant to confirm any payment, refund, policy, or fulfillment decision. Do not activate COD or Amazon MCF during incident recovery.
