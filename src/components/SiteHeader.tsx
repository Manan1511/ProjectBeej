import Link from "next/link";
import Image from "next/image";
import { MobileNav } from "@/components/MobileNav";
import { CartCountLink } from "@/components/CartCountLink";
import type { SiteSettings } from "@/lib/types";

export function SiteHeader({ settings = {}, preview = false }: { settings?: SiteSettings; preview?: boolean } = {}) {
  const announcement = settings.announcement || "Free shipping on orders above ₹499 🌱";
  return (
    <>
      {settings.visibility?.announcement === false ? null : <div className="announcement">{announcement}</div>}
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
            {preview ? null : <CartCountLink />}
          </div>
          <MobileNav preview={preview} />
        </nav>
      </header>
    </>
  );
}
