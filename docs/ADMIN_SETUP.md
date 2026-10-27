# Project Beej content studio setup

The protected content studio is available at `/admin`. It edits storefront copy and section visibility, keeps drafts private, and publishes approved content to Shopify. Products, prices, inventory, orders, checkout, shipping, and legal policies continue to be managed in Shopify Admin.

## Local setup

1. Use Node.js 22 and install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local` and configure the existing Shopify Admin app credentials and the server-only Storefront token.
3. Configure the existing tracking Supabase project in `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Admin sign-in uses the existing durable rate limiter and fails closed if it is unavailable.
4. Run `npm run admin:setup` in an interactive terminal. Choose and confirm a 12 to 128 character owner password. The command writes a salted scrypt password hash and an independent random session-signing secret to `.env.local`; it does not print either secret.
5. Run `npm run dev` and open `/admin`.

For production, set `ADMIN_OWNER_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` as private runtime environment variables in the hosting provider. Generate them with the setup command, then securely transfer the values from `.env.local`. Do not commit `.env.local`, place either value in a `NEXT_PUBLIC_*` variable, or store them in Shopify. Rotate both values to invalidate existing sessions. The session cookie is HttpOnly, SameSite=Strict, and lasts eight hours; it is Secure in production.

Admin routes also require the existing `SHOPIFY_ADMIN_CLIENT_ID`, `SHOPIFY_ADMIN_CLIENT_SECRET`, `SHOPIFY_STORE_DOMAIN`, and `SHOPIFY_API_VERSION` values. The Admin API app must be installed on the target store, and its token must be allowed to read and update the Shop settings metafield. Product choices come from the Headless Storefront catalog. Do not grant product-write or order-write access for this editor.

## Shopify content fields

Published settings are stored in the Shop JSON metafield `beej.storefront_settings`. Keep its Storefront API access set to public read so the storefront can render it. If the metafield does not exist yet, create it on the Shop resource with namespace `beej`, key `storefront_settings`, type `json`, and Storefront read access. Existing keys outside the editor remain in place when publishing.

Saved drafts use the `storefront_content_draft` app-data metafield on the current AppInstallation. Shopify limits these app-data metafields to the owning app, and they are not exposed by the public Storefront API. Do not copy the draft into the public Shop metafield manually.

The editor’s initial values come from the current storefront defaults when no published setting exists. Saving only creates or updates the private draft. Publish promotes the saved content and updates the draft’s base hash together through Shopify’s atomic `metafieldsSet` compare-and-set operation. If Shopify content changed in another tab or app, the editor reports a conflict and requires a reload rather than overwriting the newer content.

## Using the editor

- Edit Home, Shop, Our Story, or Shared content. Every editable field has a reset-to-default control.
- Use section switches to include or remove optional sections. Turning off “Snacking is a sport” removes its full Home section and its layout spacing.
- Choose and order up to four products for the Home featured shelf. Hero image rotation remains independent and uses the catalog.
- Save draft, then preview Home, Shop, or Our Story at desktop or mobile width. Preview links, cart actions, newsletter submission, and commerce tracking are disabled.
- Publish shows the changed content areas before updating the live site. Public settings use the existing 60-second cache policy, and publishing invalidates the affected cache and routes.
- Use the Shopify Admin shortcuts for catalog, order, and store settings work that this editor does not manage.

All admin and preview responses are private, uncached, and marked noindex. Login attempts use the existing durable rate-limit store. The public layout does not read the admin session cookie, and admin drafts are never returned from public settings APIs.

## Production checklist

- Set the production owner hash and independent session secret. Confirm Supabase rate limiting is configured and its tracking migration is applied.
- Confirm the Admin API app credentials, store domain, API version, and Shopify access to the Shop settings metafield.
- Confirm `beej.storefront_settings` is Storefront-readable and `storefront_content_draft` remains app data.
- Sign in at `/admin`, save a harmless draft, preview it, discard it, then publish only after the owner reviews the changes.
- Verify the public home, shop, and about pages after publish, including the 60-second cache refresh and section visibility.
