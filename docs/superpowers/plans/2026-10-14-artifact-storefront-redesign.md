# Project Beej Artifact Storefront Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Home, Shop, Product, About, and Cart experiences to match the approved Claude artifact while preserving Shopify-backed commerce and truthful product content.

**Architecture:** Keep the existing Next.js server pages, client commerce components, Storefront API, and global stylesheet. Restyle the shared header/footer and page layouts around the artifact, adapt the home banner into paired portrait images, and leave all cart, checkout, attribution, and product data flows intact.

**Tech Stack:** Next.js 16.4, React 19, TypeScript, Tailwind CSS v4, locally served DM Serif Display and Outfit fonts, existing CSS animations, Vitest, Shopify Storefront API.

**Spec:** `docs/superpowers/specs/2026-10-14-project-beej-artifact-redesign.md`

## Global Constraints

- Use the Claude artifact as the binding visual reference for Home, Shop, Product, About, and Cart.
- Shopify is authoritative for catalog, variants, prices, discounts, availability, carts, orders, and hosted checkout.
- Do not hard-code sample product prices or free-shipping thresholds.
- Omit unverified health, nutrition, ingredient, allergen, certification, origin, tax, shipping, and review claims.
- Keep Search, Contact, and policy routes outside the current visual redesign.
- Keep all private credentials server-side.
- Remove all em dashes from interface copy.
- Make every interaction work with keyboard, touch, and reduced-motion preferences.

## Review Focus

- Shopify preview or unavailable variants must never present an enabled purchase action. Exercise preview and unavailable states in ProductDetail and ProductGrid tests.
- Artifact sample prices and shipping thresholds must not appear as live data. Assert rendered copy is Shopify-driven or neutral in route tests.
- Hard-coded unverified nutrition, allergen, tax, or origin claims must not render. Assert fixed route copy omits these terms.
- Hero and ticker motion must respect reduced-motion settings and preserve keyboard controls. Assert reduced-motion and focus-pause behavior in the motion test.
- Narrow mobile navigation and cart states must not overlap controls or strand the visitor. Verify closed-after-navigation behavior and both empty and populated carts in browser checks.

---

### Task 1: Home composition and motion

**Files:**
- Create: `src/app/reference-home.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/page.tsx`
- Modify: `src/components/BannerSlider.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/motion.test.ts`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Keep `BannerSlider({ settings }: { settings: SiteSettings })` and existing `settings.slides` data. Render the active slide and next slide as the two hero portraits, with the existing previous/next controls selecting the pair.
- Keep existing `HomePage()` data loading, featured product ordering, newsletter form, gallery, tracking, and Shopify settings behavior.

- [ ] **Step 1: Write failing home-content tests**

In `src/app/reference-home.test.ts`, mock only the existing data calls as `src/app/home-featured-products.test.ts` does. Assert the rendered HomePage tree contains “Good things grow from small seeds.”, “Shop now”, and “Our story”; that the feature sections follow the artifact order; and that fixed copy does not contain unsupported health, nutrition, allergen, tax, or origin claims. Also add the new `.artifact-home-hero` and `.artifact-benefit-track` motion assertions to `src/app/motion.test.ts`, including reduced-motion and focus-pause behavior.

- [ ] **Step 2: Run the new tests and verify they fail on the current copy, section order, and hero selector**

Run: `npm test -- src/app/reference-home.test.ts src/app/motion.test.ts`
Expected: FAIL because HomePage still renders the superseded headline and section order, and the new hero selector does not exist yet.

- [ ] **Step 3: Implement artifact Home structure and copy**

Reshape `src/app/page.tsx` to the artifact sequence: hero, benefits strip, team, featured products, category shortcuts, story, values, community gallery, newsletter. Keep live product data and existing forms. Use the approved headline and safe artifact copy. Replace unsupported health language and all em dashes. Update root metadata to remove unsupported “wholesome” wording. Add `@fontsource/dm-serif-display` for the self-hosted editorial display face; retain Outfit for utility text.

- [ ] **Step 4: Make the hero a two-portrait slider**

Update `BannerSlider` to show two portrait images from `settings.slides` or the existing local defaults. Previous/next changes the displayed pair, preserves promotion tracking, and keeps visible accessible controls. Keep rotation user-controlled; do not add autoplay.

- [ ] **Step 5: Implement the Home visual system in `src/app/globals.css`**

Match the artifact's cream, olive, and sage palette, editorial serif display type, sans-serif utility type, dark radial hero, paired photo frames, moving pale-sage benefits strip, section spacing, and responsive order. Use CSS transitions and keyframes already supported by the stack. Respect reduced motion and do not place decoration over text or purchase controls.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/app/reference-home.test.ts src/app/motion.test.ts src/app/home-featured-products.test.ts`
Expected: PASS, including unchanged configured featured-product ordering.

- [ ] **Step 7: Commit the verified Home milestone**

Commit message: `feat: match homepage to approved Beej artifact`

### Task 2: Shared navigation, Shop, and About

**Files:**
- Create: `src/app/reference-shop-about.test.ts`
- Modify: `src/components/SiteHeader.tsx`
- Modify: `src/components/MobileNav.tsx`
- Modify: `src/components/SiteFooter.tsx`
- Modify: `src/app/shop/page.tsx`
- Modify: `src/app/about/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Keep `SiteHeader({ settings }: { settings: SiteSettings })`, Shopify cart count, `MobileNav({ count }: { count: number })`, `ProductGrid`, `StoreSearchForm`, `getProducts`, and `getShopifyPage` contracts.
- Keep footer contact, policy, consent, WhatsApp, and social destinations available while matching the artifact's compact visual treatment.

- [ ] **Step 1: Write failing Shop and About route tests**

In `src/app/reference-shop-about.test.ts`, mock Shopify data calls and assert Shop renders the artifact's “Shop all” heading and on-page search form while retaining filters and sorting. Assert About renders “Rooted in nature. Growing with purpose.”, its origin-story hierarchy, and no unsupported fixed health/nutrition/allergen claims. Assert both routes use the new `.artifact-shop-hero` and `.artifact-about-hero` composition hooks.

- [ ] **Step 2: Run the route test and verify it fails on the old layout copy**

Run: `npm test -- src/app/reference-shop-about.test.ts`
Expected: FAIL because Shop's heading punctuation and the new Shop/About composition hooks do not yet match the approved design.

- [ ] **Step 3: Match shared navigation and footer**

Update desktop navigation to Home, Shop, and Our Story with the centered Project Beej wordmark and live bag count. Match the artifact's olive header and compact announcement strip. On mobile, keep the same destinations and bag count, remove the Contact link from the menu, and close the menu after route selection. Restyle the shared footer to the artifact while retaining working contact, legal, consent, and social links.

- [ ] **Step 4: Match Shop and About page composition**

Style Shop with the dark foliage masthead, clear category filters, sort, on-page search, and Shopify-driven cards. Keep counts and availability based on live Shopify results. Style About with the seedling hero, story, supplied photo collage, values, and shop CTA. Use supported copy only and keep contact/policy routes unchanged.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/app/reference-shop-about.test.ts src/lib/product-search.test.ts src/app/home-featured-products.test.ts`
Expected: PASS, including Shop search/filter behavior and Home product ordering.

- [ ] **Step 6: Commit the shared shell and discovery milestone**

Commit message: `feat: align Beej navigation and discovery pages`

### Task 3: Product detail and Cart

**Files:**
- Create: `src/app/reference-commerce-pages.test.ts`
- Create: `src/components/commerce-presentation.test.ts`
- Modify: `src/components/ProductDetail.tsx`
- Modify: `src/components/CartPanel.tsx`
- Modify: `src/app/products/[handle]/page.tsx`
- Modify: `src/app/cart/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Keep the existing ProductDetail props, Shopify variant and quantity mutations, `add_to_cart`, `begin_checkout`, gallery controls, FAQ/review parsing, related product list, and variant query parameter.
- Keep `CartPanel({ initialCart, shippingConfigured })`, current cart API routes, `readStoredCartId`, `getShopifyCart`, checkout URL creation, and cart tracking events.

- [ ] **Step 1: Write failing route-contract tests**

In `src/app/reference-commerce-pages.test.ts`, mock only Shopify reads. Assert ProductPage passes the selected numeric `?variant=` to ProductDetail and passes only Shopify-derived product data. Assert CartPage passes the real initial cart into CartPanel and never hard-codes the artifact's sample shipping threshold or prices. Assert product and cart render the new `.artifact-product-layout`, `.artifact-cart-empty`, and `.artifact-cart-filled` composition hooks. In `src/components/commerce-presentation.test.ts`, server-render ProductDetail and ProductGrid with preview and unavailable fixtures; assert purchase actions stay disabled, unsupported claim badges stay absent, and the new artifact layout hooks are present.

- [ ] **Step 2: Run the route-contract tests and verify they fail for any missing reference content**

Run: `npm test -- src/app/reference-commerce-pages.test.ts src/components/commerce-presentation.test.ts`
Expected: FAIL on the new Product and Cart composition hooks before component changes.

- [ ] **Step 3: Restyle Product detail around the artifact**

Use a large responsive product gallery beside a clear Shopify-backed purchase panel, then the mascot feature and related products. Keep variant availability, quantity limits, Add to Bag, independent Buy Now, true FAQs/reviews, and honest empty states. Remove artifact claim badges unless verified structured Shopify data supports them. Keep the packaging prompt neutral when ingredient/allergen data is absent.

- [ ] **Step 4: Restyle Cart empty and populated states**

Match the empty-bag illustration, sage panel, and clear Shop CTA. Give the populated cart the same typography, spacing, and restrained olive/sage treatment while preserving live line items, quantity updates, removal, totals, messages, and Shopify-hosted checkout. Do not present the reference's sample shipping promise unless the current Shopify configuration confirms it.

- [ ] **Step 5: Run commerce and route tests**

Run: `npm test -- src/app/reference-commerce-pages.test.ts src/lib/cart-actions.test.ts src/lib/commerce.test.ts src/lib/storefront.test.ts`
Expected: PASS, including cart recovery/mutation and existing product data behavior.

- [ ] **Step 6: Commit the commerce-page milestone**

Commit message: `feat: align product and cart pages to Beej artifact`

### Task 4: Responsive, accessibility, and release verification

**Files:**
- Modify only the files above if screenshot review finds a defect.
- Run the Impeccable detector over changed UI files once after the final correction.

- [ ] **Step 1: Run the full automated checks**

Run: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
Expected: all commands pass with no new warnings or TypeScript errors.

- [ ] **Step 2: Start the storefront on port 3001 and inspect all five routes**

Run: `npm run dev -- --port 3001`
Expected: Home, Shop, About, a published Product, and Cart render from the current project on port 3001.

- [ ] **Step 3: Compare desktop, tablet, and mobile layouts with the Claude artifact**

Inspect Home, Shop, Product, About, empty Cart, and populated Cart at 1440px, 768px, and 390px widths. Test keyboard navigation, mobile menu dismissal, slider buttons, reduced motion, product filters/search, variants, Add to Bag, Buy Now, cart update/removal, and Shopify checkout URL handoff. Correct all material visual or interaction defects, then run one confirmation pass.

- [ ] **Step 4: Run Impeccable's manual detector once**

Run: `C:\Users\manan\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/app/layout.tsx src/app/page.tsx src/app/shop/page.tsx src/app/about/page.tsx 'src/app/products/[handle]/page.tsx' src/app/cart/page.tsx src/components/SiteHeader.tsx src/components/MobileNav.tsx src/components/SiteFooter.tsx src/components/BannerSlider.tsx src/components/ProductDetail.tsx src/components/CartPanel.tsx src/app/globals.css`
Expected: inspect all findings and fix material issues before final review.

- [ ] **Step 5: Commit final verified corrections**

Commit message: `fix: polish responsive Beej artifact implementation`

## Self-review

- Spec coverage: Tasks 1–3 cover the five referenced pages, shared shell, art direction, safe copy, and preserved Shopify commerce. Task 4 covers responsiveness, accessibility, reduced motion, screenshots, the detector, and build checks.
- Step granularity: every task starts with a failing behavior/content test, then implementation, focused verification, and a scoped commit. Browser comparison remains a separate final acceptance check.
- Type consistency: shared component and existing API signatures are preserved. Product variant selection remains a numeric Shopify ID mapped to the existing GID.
- Review Focus: all five listed risks have corresponding tests or browser checks.
- Proportion: the plan is shorter than the spec and limits source changes to shared visual components and the five approved routes.
