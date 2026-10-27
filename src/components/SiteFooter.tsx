"use client";

import Link from "next/link";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";
import { ConsentSettingsButton, TrackedOutboundLink } from "@/components/TrackedOutboundLink";
import { NewsletterForm } from "@/components/NewsletterForm";
import { useStorefrontSettings } from "@/components/StorefrontSettingsProvider";

export function SiteFooter({ settings: fallback = {}, preview = false }: { settings?: SiteSettings; preview?: boolean } = {}) {
  const { settings } = useStorefrontSettings(fallback);
  const email = settings.contactEmail || "hello@projectbeej.com";
  return (
    <>
      {settings.visibility?.newsletter === false ? null : <section className="newsletter-section footer-newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-inner">
          <div className="newsletter-copy">
            <h2 id="newsletter-title">
              {settings.homeCopy?.newsletterTitleLead || "Be first to the"} <span>{settings.homeCopy?.newsletterTitleEmphasis || "next drop"}</span>
            </h2>
            <p>{settings.homeCopy?.newsletterDescription || "New flavours, new snacks and early-access offers. No spam."}</p>
          </div>
          {preview ? <div className="newsletter-form newsletter-preview-form"><div className="newsletter-fields"><input type="email" placeholder="Your email" aria-label="Your email, disabled in preview" disabled /><button className="button button-sage" type="button" disabled>Join</button></div></div> : <NewsletterForm />}
        </div>
      </section>}
      <footer className="site-footer artifact-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="footer-logo" aria-label="Project Beej home">
              <Image src="/assets/logo-wordmark.png" alt="Project Beej" fill sizes="(max-width: 760px) 130px, 150px" />
            </Link>
            <p>{settings.footerCopy?.tagline || "Rooted in nature. Growing with purpose."}</p>
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
            {preview ? <a href={`mailto:${email}`}>{email}</a> : <TrackedOutboundLink href={`mailto:${email}`} kind="email">{email}</TrackedOutboundLink>}
            <p>{settings.footerCopy?.location || "Surat, Gujarat, India"}</p>
            {settings.instagramUrl ? <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a> : null}
            {settings.whatsappUrl ? (preview ? <a href={settings.whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a> : <TrackedOutboundLink href={settings.whatsappUrl} kind="whatsapp" target="_blank" rel="noreferrer">WhatsApp</TrackedOutboundLink>) : null}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Project Beej Foods Pvt. Ltd. · Product of India</span>
          <div className="footer-legal-links" aria-label="Legal and privacy links">
            <Link href="/policies/privacy">Privacy</Link>
            <Link href="/policies/refund">Refunds</Link>
            <Link href="/policies/terms">Terms</Link>
            {preview
              ? <button className="footer-consent-settings" type="button" disabled>Privacy settings</button>
              : <ConsentSettingsButton className="footer-consent-settings">Privacy settings</ConsentSettingsButton>}
          </div>
        </div>
      </footer>
    </>
  );
}
