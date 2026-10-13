import type { BeejProduct } from "./types";

export function searchProducts(products: BeejProduct[], query: string): BeejProduct[] {
  const normalizedQuery = query.trim().slice(0, 80).toLocaleLowerCase();
  if (!normalizedQuery) return products;

  return products.filter((product) =>
    `${product.title} ${product.productType} ${product.description}`
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  );
}
