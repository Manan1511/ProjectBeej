"use client";

import { useRef } from "react";
import Link from "next/link";
import { useCartCount } from "@/components/CartCountLink";

export function MobileNav({ count }: { count: number }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const cartCount = useCartCount(count);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <details className="mobile-nav" ref={menuRef}>
      <summary aria-label="Open navigation menu"><span></span><span></span><span></span></summary>
      <div className="mobile-menu">
        <Link href="/" onClick={closeMenu}>Home</Link>
        <Link href="/shop" onClick={closeMenu}>Shop the snacks</Link>
        <Link href="/about" onClick={closeMenu}>Our story</Link>
        <Link href="/cart" onClick={closeMenu}>Bag ({cartCount})</Link>
      </div>
    </details>
  );
}
