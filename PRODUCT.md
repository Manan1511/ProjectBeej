# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the approved storefront brief and INR catalog: shoppers in India discovering and buying packaged makhana snacks online.

## Product Purpose

Project Beej sells roasted makhana in multiple flavors and plain makhana for home roasting. The storefront should help shoppers understand the range, choose products, and complete orders through Shopify.

## Positioning

Project Beej presents nature-rooted snacks with playful athlete mascots for each flavor. Avoid health, nutrition, ingredient, allergen, or certification claims unless verified product data supports them.

## Operating Context

The storefront serves India in INR. Shopify is authoritative for catalog, variants, prices, availability, carts, orders, and hosted checkout. The public site uses the `projectbeej.com` domain and is hosted on Netlify. Marketing measurement requires visitor consent.

## Capabilities and Constraints

- Existing storefront uses Next.js 16, React 19, TypeScript, and Shopify Storefront API.
- Shoppers can browse and search products, choose variants and quantities, add to cart, use Buy Now, and continue to Shopify checkout.
- Shopify payment processing and order status remain authoritative.
- COD remains disabled until configured. Amazon Multi-Channel Fulfillment remains a later stage.
- Keep Search, Contact, and policy routes outside the current visual redesign scope.
- Do not expose Shopify, Supabase, or provider secrets in source or browser bundles.

## Brand Commitments

- Brand name: Project Beej.
- Keep the existing brand voice rooted in nature, playful, and clear.
- Use the user's Claude artifact as the binding visual reference for Home, Shop, Product, About, and Cart. The earlier local reference was superseded by the user's correction.
- Use the artifact's copy where present, while preserving Shopify product facts and omitting unverified claims.

## Evidence on Hand

- Current brand, product, and mascot assets are in `public/assets/`.
- Current implementation and live commerce behavior are in the existing Next.js storefront.
- The Claude artifact at `https://claude.ai/artifact/1DoL5jmSmLB9mqxSURXarY` contains the approved five-page visual reference.
- Do not invent customer reviews or product facts. Show only approved reviews and verified merchant data.

## Product Principles

1. Keep product and checkout information truthful and Shopify-authoritative.
2. Make it easy to move from discovery to a confident purchase.
3. Preserve the nature-rooted, playful Beej voice without unsupported claims.
4. Respect visitor consent for optional measurement.
