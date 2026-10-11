import Link from "next/link";
import type { BeejProduct } from "@/lib/types";
import { ProductGrid } from "@/components/ProductGrid";

export function StoreSearchForm({ query, products }: { query: string; products: BeejProduct[] }) {
  return <>
    <form className="search-form" action="/search" role="search">
      <label className="sr-only" htmlFor="store-query">Search snacks</label>
      <input autoFocus id="store-query" name="q" type="search" defaultValue={query} placeholder="Try Pudina or peri peri…" />
      <button className="button button-dark" type="submit">Search</button>
    </form>
    {query ? <><p className="search-count">{products.length ? `${products.length} snack${products.length === 1 ? "" : "s"} for “${query}”` : `No snacks found for “${query}”`}</p>{products.length ? <ProductGrid products={products} /> : <Link className="text-link" href="/shop">Browse all snacks ↗</Link>}</> : <p className="search-count">Search the Beej pantry by flavour or snack type.</p>}
  </>;
}
