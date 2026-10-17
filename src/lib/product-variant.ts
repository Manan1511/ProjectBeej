import type { ProductVariant } from "@/lib/types";

/** Resolves Shopify's numeric `?variant=` URL value without making product rendering request-dynamic. */
export function variantIdFromSearch(variants: Pick<ProductVariant, "id">[], search: string): string | undefined {
  const requested = new URLSearchParams(search).get("variant");
  if (!requested || !/^\d{1,20}$/.test(requested)) return undefined;
  return variants.find((variant) => variant.id.endsWith(`/${requested}`))?.id;
}
