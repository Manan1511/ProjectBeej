"use client";

import { useRef } from "react";
import Link from "next/link";
import { useCartCount } from "@/components/CartCountLink";

export function MobileNav({ preview = false }: { preview?: boolean } = {}) {
  if (preview) return <PreviewMobileNav />;
  return <LiveMobileNav />;
}

function PreviewMobileNav() {
  const menuRef = useRef<HTMLDetailsElement>(null);

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
      </div>
    </details>
  );
}

function LiveMobileNav() {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const cartCount = useCartCount();

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
        <Link href="/cart" onClick={closeMenu}>{cartCount === null ? "Bag" : `Bag (${cartCount})`}</Link>
      </div>
    </details>
  );
}
