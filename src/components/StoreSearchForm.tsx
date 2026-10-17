"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";
import { emitSearch } from "@/lib/tracking-client";

export function StoreSearchForm({ query, resultCount, compact = false }: { query: string; resultCount: number; compact?: boolean }) {
  const lastSearch = useRef("");
  useEffect(() => {
    if (!query) { lastSearch.current = ""; return; }
    const key = `${query}:${resultCount}`;
    if (lastSearch.current === key) return;
    lastSearch.current = key;
    emitSearch(query, resultCount);
  }, [query, resultCount]);

  return <>
    <Form id="shop-search" className={compact ? "search-form search-form-compact" : "search-form"} action="/shop" role="search">
      <label className="sr-only" htmlFor="store-query">Search snacks</label>
      <input id="store-query" name="q" type="search" defaultValue={query} placeholder="Search the pantry" />
      {compact ? <button className="search-icon-button" type="submit" aria-label="Search snacks"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.4" /><path d="m15.5 15.5 4.2 4.2" /></svg></button> : <button className="button button-dark" type="submit">Search</button>}
    </Form>
    {query ? <p className={compact ? "search-count sr-only" : "search-count"} aria-live="polite">{resultCount ? `${resultCount} snack${resultCount === 1 ? "" : "s"} for “${query}”` : `No snacks found for “${query}”`}</p> : null}
  </>;
}
