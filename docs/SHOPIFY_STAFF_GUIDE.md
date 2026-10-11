# Project Beej Shopify staff guide

Use Shopify Admin as the control room for the catalog, stock, orders, checkout policies, and the content that feeds the headless storefront. This storefront does not copy product prices or inventory into a separate database.

## Guided walkthrough

### 1. Add and publish a product

1. In Shopify Admin, open **Products** and add or open one item.
2. Enter its approved name and customer-facing description, add the final product images, and set the confirmed price and variant/pack size.
3. Enter the SKU, inventory quantity, shipping details, product category/type, and only verified ingredients, nutrition, allergens, storage, tax, and dispatch information.
4. In **Publishing**, make the product available to the **Headless** sales channel. Save it, then check that its status and stock are correct.
5. Put flavoured jars in **Roasted Makhana** and Classic Makhana in **Ready to Roast**. The storefront groups products using Shopify collection handles/product types.
6. Open the storefront’s `/shop` page and product page to confirm its image, copy, selected variant, availability, and price.

Do not publish a product for sale until the merchant confirms all commercial, legal, food-label, tax, and fulfillment details. The ₹299 and ₹149 amounts in preview mode are drafts, not Shopify catalog values.

### 2. Update homepage and contact content

The app reads the JSON shop metafield `beej.storefront_settings`. Define it under **Settings → Metafields and metaobjects → Store**, use the JSON type, and grant Storefront API access. Edit its value to change the announcement, hero banner slides, featured product handles, homepage copy, contact email, WhatsApp URL, and Instagram URL.

Keep the current value before editing. Preserve valid JSON and use only public contact/social links. Images can reference the supplied `/assets/` files or HTTPS images hosted on Shopify’s CDN. The Pudina slide remains the default when no slide list is supplied.

Homepage text is entered as plain text under `homeCopy` (see the complete example in [Shopify setup](SHOPIFY_SETUP.md)). Leave a field out to keep the designed default. The app trims and bounds values, escapes text in the page, and requests current settings server-side without rebuilding.

### 3. Maintain the About page, FAQs, and reviews

- Create or edit a Shopify Page with handle `about-us` for the managed About section. The storefront keeps its designed layout and replaces the optional lower content with the Shopify page body.
- On each product, add JSON metafield definitions `beej.faqs` and `beej.approved_reviews`, enable Storefront API access, and fill them with verified content.
- FAQ entries use `{ "question": "...", "answer": "..." }`.
- Review entries use `{ "author": "...", "rating": 5, "title": "...", "body": "..." }`. Add only genuine, approved customer reviews; the site is display-only and has no review-submission flow.

### 4. Maintain policies

Complete Privacy, Refund, and Terms policies in Shopify Admin under **Settings → Policies**. The storefront reads these native policy fields. Its policy routes display an explicit setup-needed state when a policy is blank. Have the merchant approve policy wording before publication.

### 5. Work orders and inventory

Open **Orders** to check payment and fulfillment status, customer notes, fraud indicators, and shipping details. Shopify checkout owns the final total, shipping, tax, discount, payment result, confirmation, and order record.

With first-launch COD disabled, ship only under the merchant’s approved dispatch process after the Shopify order shows the correct successful payment state. Update tracking/fulfillment in Shopify. Process cancellations, returns, and refunds from the order in Shopify Admin in line with the approved policy. Never treat a browser redirect alone as proof that an order is paid.

## Access and safety

- Give each staff member their own Shopify account and only the permissions needed for their role.
- Keep Storefront and Admin tokens out of product/page content, browser code, screenshots, email, and source control.
- The newsletter endpoint needs a separate server-only Admin token with `write_customers`; do not put an Admin `shpat_` token in the Storefront token setting.
- Do not enable COD or Amazon MCF as part of ordinary catalog edits. Those workflows need separate merchant approval and fulfillment testing.

## Official Shopify references

- [Adding and updating products](https://help.shopify.com/en/manual/products/add-update-products)
- [Creating collections and adding products](https://help.shopify.com/en/manual/products/collections/create-collection)
- [Creating custom metafield definitions](https://help.shopify.com/en/manual/custom-data/metafields/metafield-definitions/creating-custom-metafield-definitions)
- [Creating and editing pages](https://help.shopify.com/en/manual/online-store/add-edit-pages)
- [Managing orders](https://help.shopify.com/en/manual/fulfillment/managing-orders)
- [Fulfilling orders](https://help.shopify.com/en/manual/fulfillment/fulfilling-orders)
