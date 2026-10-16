import type { Metadata } from "next";
import Image from "next/image";
import { getRequestCachedSiteSettings } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { TrackedOutboundLink } from "@/components/TrackedOutboundLink";

export const metadata: Metadata = { title: "Contact us", description: "Get in touch with Project Beej.", ...(getPublicSiteUrl() ? { alternates: { canonical: "/contact" } } : {}) };

export default async function ContactPage() {
  const settings = await getRequestCachedSiteSettings(await requestBuyerIp());
  const email = settings.contactEmail || "hello@projectbeej.com";
  return <main id="main-content" className="contact-page"><section className="contact-hero"><span className="eyebrow">Say hello</span><h1>We’re all ears.</h1><p>A question about a flavour, your order, or just want to say hi? We’d love to hear from you.</p></section><section className="contact-cards">
    <TrackedOutboundLink className="contact-card" href={`mailto:${email}`} kind="email"><span className="contact-icon" aria-hidden="true">✉</span><span className="eyebrow">Email us</span><h2>{email}</h2><span>We’ll get back to you as soon as we can ↗</span></TrackedOutboundLink>
    {settings.whatsappUrl ? <TrackedOutboundLink className="contact-card" href={settings.whatsappUrl} kind="whatsapp" target="_blank" rel="noreferrer"><span className="contact-icon" aria-hidden="true">◉</span><span className="eyebrow">WhatsApp</span><h2>Chat with Beej</h2><span>Send us a message ↗</span></TrackedOutboundLink> : <div className="contact-card contact-card-pending"><span className="contact-icon" aria-hidden="true">◉</span><span className="eyebrow">WhatsApp</span><h2>Coming soon</h2><span>Our WhatsApp chat will be here soon.</span></div>}
    {settings.instagramUrl ? <a className="contact-card" href={settings.instagramUrl} target="_blank" rel="noreferrer"><span className="contact-icon" aria-hidden="true">◎</span><span className="eyebrow">Instagram</span><h2>Follow along</h2><span>Join the snack squad ↗</span></a> : null}
  </section><section className="contact-bottom"><Image src="/assets/seed.png" alt="" width={50} height={50} /><p>Rooted in nature. Growing with purpose.</p></section></main>;
}
