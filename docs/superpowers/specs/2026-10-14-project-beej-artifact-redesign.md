# Project Beej storefront redesign

## Status

Design proposal for user approval. No application code changes are authorized until this proposal is approved.

## Source of truth

Use the five-screen Claude artifact as the binding visual reference: [Snack landing page design](https://claude.ai/artifact/1DoL5jmSmLB9mqxSURXarY). The user's correction explicitly supersedes the earlier local reference. Limit the visual redesign to Home, Shop, Product, About, and Cart. Search, Contact, and policy routes stay outside this redesign.

The design read is an editorial, nature-rooted snack brand with a lively sports mascot cast. Keep its cream, olive, and pale-sage contrast, high-contrast serif display type, sans-serif utility type, generous image-led composition, and carefully framed product photography. The top of each page should feel like the same shop: a slim announcement strip, an olive navigation bar, centered wordmark, and a visible bag count. The reference's large type, dark radial home field, paired portrait product photos, pale moving benefit strip, and spacious section rhythm establish the finish bar.

Impeccable's direction roll assigned candidate 6. The approved artifact is a user-pinned direction, so it takes precedence over the roll. The user's code-first choice is recorded in `.impeccable/config.json`; no preliminary mock round is needed.

## Grounded directions considered

The brief's explicit visual authority remains the chosen direction. These source systems explain the roll context and the constraints used to assess challengers:

1. Agricultural field guide: clear product taxonomy and ingredient details, with a risk of looking instructional rather than appetizing.
2. Neighborhood pantry signage: familiar Indian snack-shopping cues and fast wayfinding, with a risk of becoming a generic shop board.
3. Local sports-club lineup: makes the mascot athletes and flavor personalities easy to understand, with a risk of turning commerce into a game.
4. Spice-shop tins and labels: makes flavor and product distinctions tangible, with a risk of overemphasizing packaging over food.
5. Contemporary food editorial: lets real product photography, type, and human-scale stories carry the brand, with a risk of becoming a conventional magazine landing page.
6. Seed packet and growth-cycle editorial: connects the Beej name to growth while giving the product range a distinct, image-led identity. This is the direction represented by the approved artifact.
7. Street-food menu board: supports quick choice and categories, with a risk of suggesting a restaurant rather than a packaged snack brand.

Challenger assessment follows the Impeccable seed. The drawcord cape loses on both audience identification and product clarity; keep clear, single-purpose interactions. The provenance ribbon is competitive on product clarity only; use traceability only when verified merchant data supports it. Loteria is competitive on audience identification only; preserve playful flavor personalities without making purchase navigation game-like. The patent sheet loses on both; retain only structured, factual product information. Teletext loses on both; retain concise labels and controls that can be stopped or used without motion. The shader portal loses on both; retain the reference's restrained background movement without a WebGL dependency. None overrides the user's pinned artifact.

## Experience direction

### World

An editorial seed-to-snack story: botanical growth and real snack photography meet a playful team of athlete mascots. The palette and type stay rooted in the supplied artifact. Photography should lead; use existing Project Beej product and lifestyle assets, selecting crops that match the artifact rather than substituting unrelated imagery.

### First viewport

On Home, show the announcement strip and nav before a dark olive hero. Keep a short uppercase eyebrow, large two-line serif headline, concise copy, two clear calls to action, and two tall product photographs framed like print portraits on the right. A low-contrast radial field moves slowly behind the content. Follow with a pale-sage ticker. Keep text and purchase calls to action above decorative artwork at every viewport.

### Visitor path

Home introduces the brand and the five products. Product cards, the team, and category shortcuts lead into Shop or a matching Product page. Shop has one clear catalog heading, category filters, sort, search on the Shop page, and a five-product grid when those products are published. Product pages let visitors inspect real imagery and Shopify-backed details, choose an available variant and quantity, add to the Shopify bag, or use independent Buy Now checkout. Cart presents the empty state from the artifact or a styled live order summary, then sends checkout to Shopify. About moves from the seed-growth promise into origin, values, imagery, and a shop CTA.

### Signature interactions

- Home portrait imagery and the existing banner slider should transition smoothly, with visible keyboard-operable controls and reduced-motion behavior.
- The benefit strip may scroll continuously only when motion is allowed; pause on hover and focus, and show a static alternative for reduced-motion preferences.
- Product card hover/touch states reveal a clear Add action without covering the product or title. Controls remain reachable by keyboard and do not depend on hover.
- Filters, sorting, search, gallery selection, quantity changes, FAQ disclosures, cart updates, and checkout must retain their existing functional states and Shopify data flow.
- Motion should be short and purposeful: image arrivals, card lift, button press feedback, and section reveal. No scroll hijacking, required animation to reach content, or motion that blocks purchase controls.

### Cross-surface reach

- Home uses the artifact's full section order: hero, benefits strip, team, featured products, category shortcuts, story, values, community gallery, newsletter, footer.
- Shop keeps the same editorial palette, useable filters, search, sort, real product cards, and catalog count. Counts and merchandising reflect Shopify data, not hard-coded mock inventory.
- Product pages adapt the artifact's image-led product detail layout and mascot feature. Preserve accessible gallery, variants, quantity, availability, Add to Bag, Buy Now, real FAQ/review data when present, and related products. Show an honest empty state when there are no approved reviews or FAQs.
- About follows the seedling hero, origin story, image collage, values, and shop CTA. Retain approved Shopify page content without letting it break the reference hierarchy.
- Cart follows the empty-bag reference and gives the populated Shopify cart an equally deliberate layout, including real quantities and totals, removal/update states, and Shopify-hosted checkout.
- On mobile, preserve the same hierarchy and image rhythm in a single-column flow; never let mascot stickers, nav overlays, or decorative frames obscure text or actions.

### Honest risk

The artifact contains claims and assumptions that must not ship as fact without merchant verification. Use Shopify as the authority for product names, descriptions, variants, prices, discounts, availability, shipping, currency, and checkout. Do not hard-code the artifact's sample ₹299/₹149 prices or free-shipping threshold. Omit unverified claims such as healthy/healthier, gluten-free, protein, fibre, Jain-friendly, allergen, ingredient, tax-inclusion, sealed-fresh, or origin claims. Use a shipping announcement only when the active Shopify configuration confirms its threshold and terms. Keep genuine approved customer reviews only. Remove all em dashes from interface copy, replacing them with punctuation that fits the sentence.

## Content and assets

Use the artifact copy when it is descriptive, approved, and factually supportable. Preserve the headline “Good things grow from small seeds.” and calls to action “Shop now” and “Our story.” Adapt the supporting sentence to remove unverified health language. Keep the Beej growth metaphor and playful mascot voice. Use Shopify product descriptions for product facts; do not invent ingredient, nutrition, allergen, certification, or health details. Use existing imagery in `public/assets/` and map it to the artifact's portrait, collage, product, and mascot slots. Never use low-resolution mascot variants where the high-quality assets exist.

## Scope boundaries

- Keep Shopify authoritative for catalog, cart, prices, availability, and hosted checkout.
- Do not change payment setup, tracking/consent behavior, legal copy, domain, or deployment configuration as part of the visual redesign.
- Keep Search, Contact, privacy/refund/terms pages outside the visual redesign. Shared header/footer updates may flow through them only as needed for consistent site navigation.
- Keep all private credentials server-side. Do not access or print `.env.local` values.

## Acceptance checks

- Home, Shop, Product, About, and both empty/populated Cart states match the artifact's visual hierarchy and page rhythm at desktop, tablet, and mobile widths.
- No existing Shopify action is replaced by a visual mock or dead link. Product pages use live data and variant-aware Buy Now; cart totals and checkout URL remain Shopify-backed.
- No unverified product, nutrition, allergen, shipping, discount, tax, origin, or review claim appears.
- Interactive controls work with keyboard, touch, and reduced motion. Navigation closes after a mobile route selection.
- Every visible action has a working destination or a clear disabled/unavailable state. Images have appropriate alt text and responsive loading.
- Build, typecheck, lint, and relevant tests pass. Review screenshots at wide desktop, narrow mobile, and one intermediate width, then perform one confirmation pass.
