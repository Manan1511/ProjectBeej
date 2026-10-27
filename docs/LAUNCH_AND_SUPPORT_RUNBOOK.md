# Launch and support runbook

## Launch readiness

Complete every item before opening live purchases:

- [ ] Rotate the private token shared during setup. Confirm Storefront API credentials and the installed Shopify Admin app credentials (`read_orders`, `write_customers`, `read_draft_orders`, `write_draft_orders`, `write_orders`) are present only in server settings.
- [ ] Publish the five approved products to Headless. Verify handles, collections, variants, pack sizes, prices, SKUs, stock, images, and product facts.
- [ ] Complete and approve the Privacy, Refund, and Terms policies, About page, contact email, WhatsApp link, and social links.
- [ ] Confirm Shopify India market/currency, tax configuration, merchant-managed shipping zones and rates, and dispatch capacity. Set `SHOPIFY_SHIPPING_CONFIGURED=1` only after the configured rates match the merchant’s approved shipping policy.
- [ ] For sandbox checkout verification, configure only Cashfree sandbox credentials and keep `CASHFREE_ENVIRONMENT=sandbox`. Cashfree production mode is not implemented. Leave COD disabled.
- [ ] Connect the GitHub repository to Netlify with `main` as the production branch. Confirm the root `netlify.toml` uses Node 22, `npm run build`, and `.next`.
- [ ] Protect Deploy Preview and branch-deploy URLs with team login or a site password before sharing them.
- [ ] Set scoped server-side environment variables in Netlify, including `SHOPIFY_MODE=preview` for non-production and `SHOPIFY_MODE=live` for Production, Storefront token, Admin app client ID/secret, `SITE_URL` with the final HTTPS origin, and exact verified checkout hostnames only. Store runtime credentials with **Builds** and **Functions** scopes.
- [ ] Configure the custom domain and preferred hostname in Netlify, complete its DNS validation, and verify HTTPS. Keep `.env.local` out of uploads and source control.
- [ ] Record the Netlify site, production branch, deploy identifier, and environment-variable names. Never include token values in the record.

## Acceptance walkthrough

Use a merchant-approved test method and prevent test orders from reaching dispatch:

1. Load the HTTPS site on desktop and mobile. Confirm logo, supplied assets, homepage sections, policy links, canonical domain, and no missing images.
2. Search for products and browse each collection. Confirm no unpublished product appears.
3. Open a product, select each variant, change quantity, and check stock limits and unavailable states.
4. Add to cart, update quantity, remove a line, refresh, and confirm the private cart recovers. Confirm shipping estimate behavior against the configured Shopify rate.
5. Use Buy Now and verify it starts a separate checkout without replacing the saved cart.
6. Follow Cashfree sandbox checkout for success, failure, cancel, and retry behavior. In Shopify Admin, confirm a test order is created with the correct total and that inventory is not reserved or decremented. Confirm the ordinary Shopify checkout remains available when Cashfree sandbox is not configured.
7. Submit a newsletter test only with an approved test address. Confirm customer marketing consent is recorded; confirm the endpoint reports a configuration error when the Admin integration is unavailable.
8. If a live payment/refund test is required, get the merchant’s transaction authorization first and ensure nobody dispatches the test order.

## Release and recovery

1. Deploy to a protected preview host first. Run the acceptance walkthrough and review server logs for secrets, checkout errors, and failed Shopify requests.
2. Only after the merchant approves the preview, merge or push the verified change to the Netlify production branch. Check HTTPS, redirects, all routes, Shopify checkout, and the final canonical domain.
3. Record the Netlify deploy identifier and time. A failed deploy does not replace the currently published site.
4. For a regression in a published deploy, fix forward: revert the faulty source commit or apply a corrective change, then let Netlify build a new deploy. Verify the storefront and checkout routes after it is published.
5. For an urgent checkout outage, set Production `SHOPIFY_MODE=preview` in Netlify's Functions and Builds environment scopes and deploy the change so purchase actions are disabled while the clearly marked preview remains. Fix the cause, validate checkout again, and return to `SHOPIFY_MODE=live` only after confirmation.
6. Do not delete Shopify orders or issue a refund as part of a code recovery. Resolve each affected order in Shopify Admin with the merchant.

## Post-launch support triage

Record the time, affected URL, device/browser, product/variant, Shopify order number if one exists, last successful step, and a redacted error message. Never include tokens, full payment data, or customer address in a support ticket.

- **P1: Checkout or payment failure, wrong charged total, or order/payment mismatch.** Alert the merchant promptly, pause purchase actions using the preview switch if needed, check Netlify, Cashfree, and Shopify status, and reconcile the Shopify order before retrying.
- **P2: One product, collection, or content issue.** Verify product publication, stock, metafield JSON, image URL, and product handle in Shopify; correct the source data and reload the storefront.
- **P3: Copy or layout issue without purchase impact.** Capture the affected viewport and URL, check whether it comes from Shopify-managed content or the deployed build, then schedule the smallest fix.

After resolution, verify the original flow and one neighboring route, record the cause and fix, and ask the merchant to confirm any payment, refund, policy, or fulfillment decision. Do not activate COD or Amazon MCF during incident recovery.
