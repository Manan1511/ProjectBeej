"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCountStore } from "@/components/cart-count";

export function useCartCount(initialCount: number) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => cartCountStore.subscribe(initialCount, setCount), [initialCount]);

  return count;
}

export function CartCountLink({ initialCount }: { initialCount: number }) {
  const count = useCartCount(initialCount);

  return (
    <Link className="bag-link" href="/cart" aria-label={`Bag, ${count} items`}>
      <svg className="bag-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5.5 8h13l-1 12h-11l-1-12Z" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
      </svg>
      <span className="bag-count">{count}</span>
    </Link>
  );
}
