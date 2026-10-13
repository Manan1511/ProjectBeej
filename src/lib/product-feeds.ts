import type { BeejProduct, ProductVariant } from "@/lib/types";

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function csv(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

function plain(value: string, limit = 5000): string {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

export function numericShopifyId(value: string): string | null {
  const id = value.match(/^gid:\/\/shopify\/(?:Product|ProductVariant)\/(\d+)$/)?.[1];
  return id && Number.isSafeInteger(Number(id)) ? id : null;
}

export function isValidGtin(value?: string | null): boolean {
  if (!value || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  const digits = value.split("").map(Number);
  const check = digits.pop();
  if (check === undefined) return false;
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === check;
}

function imageFor(product: BeejProduct): string {
  return product.images.find((image) => /^https:\/\//i.test(image.url))?.url || "";
}

function variantUrl(baseUrl: string, product: BeejProduct, variant: ProductVariant): string | null {
  const id = numericShopifyId(variant.id);
  if (!id || !/^[a-z0-9][a-z0-9-]*$/i.test(product.handle)) return null;
  return `${baseUrl}/products/${encodeURIComponent(product.handle)}?variant=${id}`;
}

function currentPrice(variant: ProductVariant): number | null {
  const value = Number(variant.price.amount);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function feedVariants(products: BeejProduct[], baseUrl: string) {
  const base = new URL(baseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.pathname !== "/") throw new Error("Feed base URL must be an HTTPS origin.");
  return products.filter((product) => !product.preview).flatMap((product) => {
    const image = imageFor(product);
    if (!image || !product.variants.length) return [];
    return product.variants.flatMap((variant) => {
      const id = numericShopifyId(variant.id);
      const link = variantUrl(base.origin, product, variant);
      const price = currentPrice(variant);
      if (!id || !link || price === null) return [];
      const compareAt = Number(variant.compareAtPrice?.amount);
      const validCompare = Number.isFinite(compareAt) && compareAt > price && variant.compareAtPrice?.currencyCode === variant.price.currencyCode ? compareAt : null;
      return [{ product, variant, id, link, image, price, compareAt: validCompare }];
    });
  });
}

export function buildGoogleMerchantFeed(products: BeejProduct[], siteUrl: string): string {
  const rows = feedVariants(products, siteUrl).map(({ product, variant, id, link, image, price, compareAt }) => {
    const gtin = isValidGtin(variant.barcode) ? variant.barcode : "";
    const sku = variant.sku?.trim().slice(0, 100) || "";
    const currency = variant.price.currencyCode;
    const availability = variant.availableForSale ? "in_stock" : "out_of_stock";
    const description = plain(product.description || product.title);
    return `    <item>\n      <g:id>beej_${id}</g:id>\n      <g:title>${xml(`${product.title}${variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`.slice(0, 150))}</g:title>\n      <g:description>${xml(description)}</g:description>\n      <g:link>${xml(link)}</g:link>\n      <g:image_link>${xml(image)}</g:image_link>\n      <g:availability>${availability}</g:availability>\n      <g:condition>new</g:condition>\n      <g:price>${currency} ${(compareAt ?? price).toFixed(2)}</g:price>${compareAt === null ? "" : `\n      <g:sale_price>${currency} ${price.toFixed(2)}</g:sale_price>`}\n      <g:brand>${xml((product.vendor || "Project Beej").slice(0, 70))}</g:brand>${gtin ? `\n      <g:gtin>${gtin}</g:gtin>` : ""}${sku ? `\n      <g:mpn>${xml(sku)}</g:mpn>` : ""}\n      <g:identifier_exists>${gtin || sku ? "true" : "false"}</g:identifier_exists>\n      <g:product_type>${xml(product.productType)}</g:product_type>\n    </item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">\n  <channel>\n    <title>Project Beej Product Feed</title>\n    <link>${xml(new URL(siteUrl).origin)}</link>\n    <description>Live Project Beej product catalogue</description>\n${rows.join("\n")}\n  </channel>\n</rss>`;
}

const META_COLUMNS = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "mpn", "gtin", "product_type"];

export function buildMetaCatalogFeed(products: BeejProduct[], siteUrl: string): string {
  const rows = feedVariants(products, siteUrl).map(({ product, variant, id, link, image, price }) => [
    `beej_${id}`,
    `${product.title}${variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`.slice(0, 150),
    plain(product.description || product.title),
    variant.availableForSale ? "in stock" : "out of stock",
    "new",
    `${variant.price.currencyCode} ${price.toFixed(2)}`,
    link,
    image,
    product.vendor || "Project Beej",
    variant.sku || "",
    isValidGtin(variant.barcode) ? variant.barcode || "" : "",
    product.productType,
  ].map(csv).join(",").replace(/^"(beej_\d+)"/, "$1"));
  return `${META_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}

export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
