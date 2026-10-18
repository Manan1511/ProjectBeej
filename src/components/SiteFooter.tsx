"use client";

import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";
import { ConsentSettingsButton, TrackedOutboundLink } from "@/components/TrackedOutboundLink";
import { NewsletterForm } from "@/components/NewsletterForm";
import { useStorefrontSettings } from "@/components/StorefrontSettingsProvider";

export function SiteFooter({ settings: fallback = {} }: { settings?: SiteSettings } = {}) {
  const { settings } = useStorefrontSettings(fallback);
  const email = settings.contactEmail || "hello@projectbeej.com";
  return (
    <>
      <section className="newsletter-section footer-newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-inner">
          <div className="newsletter-copy">
            <h2 id="newsletter-title">
              {settings.homeCopy?.newsletterTitleLead || "Be first to the"} <span>{settings.homeCopy?.newsletterTitleEmphasis || "next drop"}</span>
            </h2>
            <p>{settings.homeCopy?.newsletterDescription || "New flavours, new snacks and early-access offers. No spam."}</p>
          </div>
          <NewsletterForm />
        </div>
      </section>
      <footer className="site-footer artifact-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="footer-logo" aria-label="Project Beej home">
              <Image src="/assets/logo-wordmark.png" alt="Project Beej" fill sizes="(max-width: 760px) 130px, 150px" />
            </Link>
            <p>Rooted in nature. Growing with purpose.</p>
          </div>
          <nav className="footer-group" aria-label="Shop links">
            <h2>Shop</h2>
            <Link href="/shop">All snacks</Link>
            <Link href="/collections/roasted-makhana">Roasted Makhana</Link>
            <Link href="/collections/ready-to-roast">Ready to Roast</Link>
          </nav>
          <nav className="footer-group" aria-label="Project Beej links">
            <h2>Project Beej</h2>
            <Link href="/about">Our story</Link>
            <Link href="/cart">Your bag</Link>
            <Link href="/#community">#SnackWithBeej</Link>
          </nav>
          <div className="footer-group footer-contact">
            <h2>Say hello</h2>
            <TrackedOutboundLink href={`mailto:${email}`} kind="email">{email}</TrackedOutboundLink>
            <p>Surat, Gujarat, India</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Project Beej Foods Pvt. Ltd. · Product of India</span>
          <div className="footer-legal-links" aria-label="Legal and privacy links">
            <Link href="/policies/privacy">Privacy</Link>
            <Link href="/policies/refund">Refunds</Link>
            <Link href="/policies/terms">Terms</Link>
            <ConsentSettingsButton className="footer-consent-settings">Privacy settings</ConsentSettingsButton>
          </div>
        </div>
      </footer>
    </>
  );
}
