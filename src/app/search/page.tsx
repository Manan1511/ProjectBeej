import type { Metadata } from "next";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { getProducts } from "@/lib/storefront";

export const metadata: Metadata = { title: "Search the Beej pantry", description: "Find your favourite Project Beej makhana flavour.", robots: { index: false, follow: true } };
type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const allProducts = await getProducts().catch(() => []);
  const matches = query ? allProducts.filter((product) => `${product.title} ${product.productType} ${product.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : [];
  return <main id="main-content" className="search-page"><span className="eyebrow">Find your flavour</span><h1>Search the pantry.</h1><StoreSearchForm query={query} products={matches} /></main>;
}
