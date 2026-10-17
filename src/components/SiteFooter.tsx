"use client";

import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";
import { ConsentSettingsButton, TrackedOutboundLink } from "@/components/TrackedOutboundLink";
import { useStorefrontSettings } from "@/components/StorefrontSettingsProvider";

export function SiteFooter({ settings: fallback = {} }: { settings?: SiteSettings } = {}) {
  const { settings } = useStorefrontSettings(fallback);
  const email = settings.contactEmail || "hello@projectbeej.com";
  return (
    <footer className="site-footer artifact-footer">
      <div className="footer-main">
        <Link href="/" className="footer-logo" aria-label="Project Beej home">
          <Image src="/assets/logo-wordmark.png" alt="Project Beej" fill sizes="(max-width: 760px) 120px, 150px" />
        </Link>
        <div className="footer-group">
          <h2>Shop</h2>
          <Link href="/shop">All snacks</Link>
          <Link href="/collections/roasted-makhana">Roasted makhana</Link>
          <Link href="/collections/ready-to-roast">Ready to roast</Link>
        </div>
        <div className="footer-group">
          <h2>Project Beej</h2>
          <Link href="/about">Our story</Link>
          <Link href="/contact">Contact</Link>
          <TrackedOutboundLink href={`mailto:${email}`} kind="email">{email}</TrackedOutboundLink>
          {settings.whatsappUrl ? <TrackedOutboundLink href={settings.whatsappUrl} kind="whatsapp" target="_blank" rel="noreferrer">Chat on WhatsApp ↗</TrackedOutboundLink> : null}
          {settings.instagramUrl ? <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a> : null}
        </div>
        <div className="footer-group footer-policies">
          <h2>Good to know</h2>
          <Link href="/policies/privacy">Privacy</Link>
          <Link href="/policies/refund">Refunds</Link>
          <Link href="/policies/terms">Terms &amp; conditions</Link>
          <ConsentSettingsButton className="footer-consent-settings" />
        </div>
      </div>
      <div className="footer-bottom">
        <span>Good things grow from small seeds.</span>
        <span>© {new Date().getFullYear()} Project Beej</span>
      </div>
    </footer>
  );
}
