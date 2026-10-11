# Project Beej Shopify setup

This storefront is a Next.js app. Shopify remains the source of truth for products, prices, variants, inventory, discounts, carts, orders, checkout, and policy text.

## 1. Local preview

1. Use Node.js 22.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local`.
4. Keep `SHOPIFY_MODE=preview`, then run `npm run dev`.

Preview mode uses the supplied product photography, approved product names and descriptions, and draft prices (₹299 for the flavour jars and ₹149 for Classic Makhana). A visible preview strip marks these values as draft. Purchase buttons stay disabled. The previews are not written to Shopify and cannot place an order.

## 2. Storefront API

Set these server environment variables in `.env.local` and the Netlify site settings. In Netlify, set runtime credentials for both **Builds** and **Functions** so Next.js server routes can use them:

- `SHOPIFY_STORE_DOMAIN=projectbeej-1686bmnd.myshopify.com`
- `SHOPIFY_API_VERSION=2026-10`
- `SHOPIFY_CHECKOUT_HOSTS` (comma-separated exact hostnames only, if Shopify returns a verified custom checkout domain)
- `SHOPIFY_MODE=live`
- `SHOPIFY_STOREFRONT_PUBLIC_TOKEN` to the Headless channel's public Storefront token, or `SHOPIFY_STOREFRONT_PRIVATE_TOKEN` to a real Storefront private access token.

All Storefront requests run on the server. A private Storefront token stays server-only and buyer requests include Shopify's buyer IP header. The Storefront private-token environment variable rejects Admin API tokens; Admin credentials use a separate variable below. Storefront access tokens need access to published products, pages, cart read/write operations, and the storefront settings metafield. If Shopify's API returns no published products, the live storefront shows an empty shop and never substitutes preview products.

Publish the five products to the Headless sales channel in Shopify Admin:

- Peri Peri
- Cheese
- Himalayan Salt & Pepper
- Pudina
- Classic Makhana

Create or assign the `Roasted Makhana` and `Ready to Roast` product types/collections. Confirm final price, variant/pack size, tax, SKU, stock, ingredients, nutrition, allergens, and dispatch data before setting products to available. The supplied plan's price and shipping values are draft defaults; the merchant's Shopify catalog and shipping profile control checkout.

## 3. Shopify-managed storefront content

The app reads live content without a build-time snapshot. Shopify changes normally show on the next request, within the plan's 60-second target.

- Add a Shopify Page with handle `about-us` to override the reference About copy.
- Add the `beej.storefront_settings` shop metafield with JSON content type and grant it Storefront access. Supported fields:

```json
{
  "announcement": "Welcome to snacking that's rooted in nature 🌱",
  "contactEmail": "hello@example.com",
  "whatsappUrl": "https://wa.me/919999999999",
  "instagramUrl": "https://www.instagram.com/example/",
  "featuredHandles": ["pudina", "peri-peri", "cheese"],
  "homeCopy": {
    "heroEyebrow": "Light · Crunchy · Healthy",
    "heroTitleLineOne": "Small seeds.",
    "heroTitleLineTwo": "Big feels.",
    "heroDescription": "Wholesome snacks made from nature’s humblest ingredients — and seasoned like they mean it.",
    "heroShopLabel": "Shop now",
    "heroStoryLabel": "Our story",
    "shopEyebrow": "Meet your new favourites",
    "shopHeadingLead": "Pick your",
    "shopHeadingEmphasis": "player",
    "storyEyebrow": "Our story",
    "storyTitleLineOne": "Rooted in nature.",
    "storyTitleHighlight": "Growing",
    "storyTitleTail": " with purpose.",
    "storyDescription": "Project Beej was born from a simple belief: the smallest choices shape the biggest transformations.",
    "storyCta": "Read our story",
    "newsletterEyebrow": "A little good news",
    "newsletterTitleLead": "Be first to the",
    "newsletterTitleEmphasis": "next drop.",
    "newsletterDescription": "New flavours, new snacks and the occasional mascot cameo. No spam."
  },
  "slides": [
    { "image": "/assets/pudina-pop.png", "alt": "Project Beej Pudina makhana" },
    { "image": "https://cdn.shopify.com/s/files/example/hero.jpg", "alt": "Project Beej snack range" }
  ]
}
```

Slide images may use supplied `/assets/` files or HTTPS Shopify CDN images. Up to eight slide entries are read. Pudina is the default first slide when no slide list is set. Confirm the WhatsApp number and social URLs before publishing them.

The homepage copy fields are plain text, not HTML. Each field is trimmed and length-limited by the storefront. Settings and product content are fetched server-side for each request, so edits appear on the next page request without a redeploy.

For each product, create Storefront-accessible `beej.faqs` and `beej.approved_reviews` JSON metafields when content is ready. FAQs use `{ "question": "...", "answer": "..." }` entries. Approved reviews use `{ "author": "...", "rating": 5, "title": "...", "body": "..." }`. Reviews render only from this merchant-managed source; shoppers cannot submit a review. Do not add invented testimonials or unverified nutrition/health claims.

The privacy policy, refund policy, and terms page read Shopify's native policy fields. A visible setup-pending page is shown while the corresponding Shopify policy is empty. Complete and approve each policy in Shopify before launch.

## 4. Newsletter consent

Newsletter sign-up requires a separate Shopify Admin API app token in `SHOPIFY_ADMIN_ACCESS_TOKEN`. Grant only `write_customers`, then keep that credential in Netlify's server environment, never in `NEXT_PUBLIC_*`, browser code, or source control. The endpoint validates email and the required, unchecked-by-default consent box, rate-limits requests, upserts the Shopify customer, and records the consent timestamp and single-opt-in level. No signup is reported as successful if Shopify is not configured or rejects the write.

## 5. Payments, checkout, and shipping

Cart and Buy Now both create Shopify carts and redirect to a fresh Shopify checkout URL. Buy Now creates an independent one-item cart and does not replace the shopper's saved bag. Razorpay Secure must be installed and enabled for the India store in Shopify Admin. Configure merchant-managed India shipping rates there; checkout is authoritative for delivery charge, tax, discounts, payment status, and order total. Set `SHOPIFY_SHIPPING_CONFIGURED=1` only after Shopify shipping rates have been checked.

COD is not enabled. Do not turn it on until merchant dispatch and collection workflows are approved. Amazon MCF is not connected in this release; complete seller onboarding, connector/SKU mapping, inventory and tracking checks before changing fulfillment.

## 6. Netlify hosting

- Connect the GitHub repository `Manan1511/ProjectBeej` to a Netlify site and use `main` as the production branch.
- The root `netlify.toml` sets Node.js 22, `npm run build`, and `.next` as the publish directory. Netlify detects Next.js and supplies its managed Next.js runtime; do not add a pinned `@netlify/plugin-nextjs` dependency or a static-export setting.
- Add the server environment variables above in Netlify's site settings with **Builds** and **Functions** scopes. Do not put secret values in `netlify.toml`, Git, `.env.example`, or `NEXT_PUBLIC_*` variables.
- Set `SHOPIFY_MODE=preview` for Deploy Preview and branch-deploy contexts; keep purchases disabled in those contexts. Set `SHOPIFY_MODE=live` in Production only after catalog and checkout are ready. These variables must be available to Functions at runtime, not only to the build.
- Restrict non-production deployments to team login or a site password before sharing a preview URL. Netlify preview URLs are otherwise accessible to anyone who has the link.
- Set `SITE_URL` to the final HTTPS custom domain after it is attached. This enables canonical URLs and the sitemap; without it, the app does not claim an unverified canonical domain.
- Configure the custom domain in Netlify, follow its DNS instructions, and verify HTTPS and the preferred hostname after DNS validation. Netlify provisions TLS for the connected domain.

Netlify runs Next.js server routes as managed functions, so there is no persistent Node server or custom start command in production. The browser serializes cart writes and the server re-reads the cart before mutations. The in-memory keyed lock only coordinates requests handled by the same warm function instance; it is not a distributed lock across Netlify instances. If cart writes must be serialized across separate clients or instances, add and validate a shared lock/queue before making that guarantee.

## 7. Launch checks requiring merchant access

- Replace/rotate any shared credentials and enter the new values through private server settings.
- Publish real products and confirm prices, inventory, taxes, catalog access, product facts and images.
- Add and approve Shopify policies and About page content; confirm business contact email and WhatsApp/social links.
- Activate Razorpay Secure and verify Shopify order, payment state, totals, inventory decrement, failure and retry paths with an authorized test transaction.
- Confirm shipping zones and rates in checkout; test the ₹499 threshold only if the configured Shopify rates actually match it.
- Configure Netlify hosting/domain/HTTPS, then check checkout, SEO, redirects and secret exposure on the deployed host.
- Do not use a live test order without merchant authorization and a plan to prevent unintended dispatch.
