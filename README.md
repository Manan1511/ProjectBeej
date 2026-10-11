# Project Beej

Design-faithful, responsive Next.js storefront connected to Shopify Storefront API. Shopify remains the authority for catalog, price, stock, cart, checkout, orders, and policies.

## Local run

- Use Node.js 22.
- Run `npm ci`.
- Copy `.env.example` to `.env.local`.
- Leave `SHOPIFY_MODE=preview` for the local design preview, then run `npm run dev`.

Preview prices are draft-only and cannot be purchased. Set Shopify credentials and `SHOPIFY_MODE=live` only after products are published to the Headless sales channel. Keep all tokens in server-side environment variables; never commit `.env.local`.

## Shopify and Netlify handover

- [Shopify setup](docs/SHOPIFY_SETUP.md)
- [Shopify staff walkthrough](docs/SHOPIFY_STAFF_GUIDE.md)
- [Launch and support runbook](docs/LAUNCH_AND_SUPPORT_RUNBOOK.md)

## Checks

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
