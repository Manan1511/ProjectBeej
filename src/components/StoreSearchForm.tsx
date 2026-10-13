"use client";

import { useEffect, useRef } from "react";
import { emitSearch } from "@/lib/tracking-client";

export function StoreSearchForm({ query, resultCount }: { query: string; resultCount: number }) {
  const lastSearch = useRef("");
  useEffect(() => {
    if (!query) { lastSearch.current = ""; return; }
    const key = `${query}:${resultCount}`;
    if (lastSearch.current === key) return;
    lastSearch.current = key;
    emitSearch(query, resultCount);
  }, [query, resultCount]);

  return <>
    <form id="shop-search" className="search-form" action="/shop#shop-search" role="search">
      <label className="sr-only" htmlFor="store-query">Search snacks</label>
      <input id="store-query" name="q" type="search" defaultValue={query} placeholder="Try Pudina or peri peri…" />
      <button className="button button-dark" type="submit">Search</button>
    </form>
    {query ? <p className="search-count" aria-live="polite">{resultCount ? `${resultCount} snack${resultCount === 1 ? "" : "s"} for “${query}”` : `No snacks found for “${query}”`}</p> : <p className="search-count">Search the Beej pantry by flavour or snack type.</p>}
  </>;
}
