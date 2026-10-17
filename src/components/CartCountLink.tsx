"use client";

import Link from "next/link";
import { useCartSnapshot } from "@/components/cart-coordinator";

export function useCartCount() {
  const snapshot = useCartSnapshot();
  return snapshot.loaded ? snapshot.cart?.totalQuantity || 0 : null;
}

export function CartCountLink() {
  const count = useCartCount();

  return (
    <Link className="bag-link" href="/cart" aria-label={count === null ? "Bag, loading" : `Bag, ${count} items`}>
      <svg className="bag-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5.5 8h13l-1 12h-11l-1-12Z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      <span className="bag-count">{count ?? "\u00a0"}</span>
    </Link>
  );
}
