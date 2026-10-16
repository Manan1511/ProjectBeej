import Link from "next/link";
import Image from "next/image";
import { getShopifyCartCount } from "@/lib/storefront";
import { readStoredCartId } from "@/lib/cart-cookie";
import { requestBuyerIp } from "@/lib/request-ip";
import { MobileNav } from "@/components/MobileNav";
import { CartCountLink } from "@/components/CartCountLink";

export async function SiteHeader({ settings }: { settings: import("@/lib/types").SiteSettings }) {
  const oldAnnouncement = "Welcome to snacking that’s rooted in nature 🌱";
  const announcement = settings.announcement && settings.announcement !== oldAnnouncement
    ? settings.announcement
    : "Free shipping on orders above ₹499 🌱";
  let count = 0;
  try {
    const cartId = await readStoredCartId();
    if (cartId) count = await getShopifyCartCount(cartId, await requestBuyerIp());
  } catch {
    count = 0;
  }

  return (
    <>
      <div className="announcement">{announcement}</div>
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
            <CartCountLink initialCount={count} />
          </div>
          <MobileNav count={count} />
        </nav>
      </header>
    </>
  );
}
