import Link from "next/link";
import Image from "next/image";
import { getShopifyCart } from "@/lib/storefront";
import { readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";

export async function SiteHeader({ settings }: { settings: import("@/lib/types").SiteSettings }) {
  let count = 0;
  try {
    const cartId = await readStoredCartId();
    if (cartId) count = (await getShopifyCart(cartId, await requestBuyerIp()))?.totalQuantity || 0;
  } catch {
    count = 0;
  }

  return (
    <>
      <div className="announcement">{settings.announcement || "Welcome to snacking that’s rooted in nature 🌱"}</div>
      <header className="site-header">
        <nav className="nav-wrap" aria-label="Main navigation">
          <div className="nav-links nav-left">
            <Link href="/shop">Shop</Link>
            <Link href="/about">Our story</Link>
          </div>
          <Link className="brand-mark" href="/" aria-label="Project Beej home">
            <Image src="/assets/logo-wordmark.png" alt="Project Beej" fill sizes="150px" priority />
          </Link>
          <div className="nav-links nav-right">
            <Link href="/#gallery">Community</Link>
            <Link className="nav-search" href="/search" aria-label="Search products"><span aria-hidden="true">⌕</span></Link>
            <Link className="bag-link" href="/cart" aria-label={`Bag, ${count} items`}>
              Bag <span className="bag-count">{count}</span>
            </Link>
          </div>
          <details className="mobile-nav">
            <summary aria-label="Open navigation menu"><span></span><span></span><span></span></summary>
            <div className="mobile-menu">
              <Link href="/shop">Shop the snacks</Link>
              <Link href="/about">Our story</Link>
              <Link href="/search">Search</Link>
              <Link href="/#gallery">Community</Link>
              <Link href="/contact">Get in touch</Link>
              <Link href="/cart">Bag ({count})</Link>
            </div>
          </details>
        </nav>
      </header>
    </>
  );
}
