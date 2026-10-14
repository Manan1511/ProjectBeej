import Link from "next/link";
import Image from "next/image";
import { getShopifyCart } from "@/lib/storefront";
import { readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { MobileNav } from "@/components/MobileNav";

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
            <Link href="/">Home</Link>
            <Link href="/shop">Shop</Link>
            <Link href="/about">Our story</Link>
          </div>
          <Link className="brand-mark" href="/" aria-label="Project Beej home">
            <Image src="/assets/logo-wordmark.png" alt="Project Beej" fill sizes="150px" loading="eager" />
          </Link>
          <div className="nav-links nav-right">
            <Link className="bag-link" href="/cart" aria-label={`Bag, ${count} items`}>
              Bag <span className="bag-count">{count}</span>
            </Link>
          </div>
          <MobileNav count={count} />
        </nav>
      </header>
    </>
  );
}
