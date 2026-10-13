import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search snacks", robots: { index: false, follow: true } };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] || "" : q || "";
  const target = query ? `/shop?q=${encodeURIComponent(query)}#shop-search` : "/shop#shop-search";
  redirect(target);
}
