import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BannerSlider } from "@/components/BannerSlider";
import { HeroStripes } from "@/components/HeroStripes";
import { NewsletterForm } from "@/components/NewsletterForm";
import { ProductGrid } from "@/components/ProductGrid";
import { getProducts, getSiteSettings } from "@/lib/storefront";
import type { BeejProduct } from "@/lib/types";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";
import { escapeJsonLd } from "@/lib/product-feeds";

export const metadata: Metadata = {
  title: "Small seeds. Big feels.",
  description: "Wholesome snacks made from nature’s humblest ingredients, seasoned like they mean it.",
  ...(getPublicSiteUrl() ? { alternates: { canonical: "/" } } : {}),
};

const pillars = [
  { n: "01", title: "Humble ingredients", body: "Nature already did the hard work. We keep labels short and honest." },
  { n: "02", title: "Mindful habits", body: "Small, everyday swaps that add up to feeling better." },
  { n: "03", title: "Joy in every bite", body: "Good-for-you should still be fun. Flavour is non-negotiable." },
];

const gallery = [
  { src: "/assets/pudina-hands.jpg", alt: "A hand reaches for Project Beej Pudina makhana" },
  { src: "/assets/himalayan-yoga.jpg", alt: "Project Beej Himalayan Salt & Pepper pack in a bright lifestyle scene" },
  { src: "/assets/cheese-table.jpg", alt: "Project Beej Cheese makhana styled on a yellow table" },
  { src: "/assets/peri-flatlay.jpg", alt: "Project Beej Peri Peri makhana with bold spices" },
];

async function homeData(): Promise<{ products: BeejProduct[]; settings: Awaited<ReturnType<typeof getSiteSettings>> }> {
  const buyerIp = await requestBuyerIp();
  const [settings, productResult] = await Promise.all([
    getSiteSettings(buyerIp),
    getProducts(buyerIp).catch(() => []),
  ]);
  const featuredHandles = settings.featuredHandles;
  const products = featuredHandles?.length
    ? [...productResult].sort((a, b) => {
      const rank = (handle: string) => {
        const index = featuredHandles.indexOf(handle);
        return index === -1 ? featuredHandles.length : index;
      };
      return rank(a.handle) - rank(b.handle);
    })
    : productResult;
  return { settings, products: products.slice(0, 5) };
}

export default async function HomePage() {
  const { products, settings } = await homeData();
  const siteUrl = getPublicSiteUrl();
  const organization = siteUrl ? { "@context": "https://schema.org", "@type": "Organization", name: "Project Beej", url: siteUrl, ...(settings.instagramUrl ? { sameAs: [settings.instagramUrl] } : {}), ...(settings.contactEmail ? { email: settings.contactEmail } : {}) } : null;
  return (
    <main id="main-content">
      {organization ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(organization) }} /> : null}
      <section className="hero-section">
        <HeroStripes />
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow"><i /> {settings.homeCopy?.heroEyebrow || "Light · Crunchy · Healthy"}</span>
            <h1>{settings.homeCopy?.heroTitleLineOne || "Small seeds."}<br /><span>{settings.homeCopy?.heroTitleLineTwo || "Big feels."}</span></h1>
            <p>{settings.homeCopy?.heroDescription || "Wholesome snacks made from nature’s humblest ingredients, seasoned like they mean it."}</p>
            <div className="hero-actions"><Link className="button button-sage" href="/shop">{settings.homeCopy?.heroShopLabel || "Shop now"}</Link><Link className="button button-hero-outline" href="/about">{settings.homeCopy?.heroStoryLabel || "Our story"}</Link></div>
          </div>
          <BannerSlider settings={settings} />
        </div>
      </section>

      <div className="benefit-ribbon" role="region" aria-label="What Beej brings to your snack break. Focus here or hover to pause the scrolling text." tabIndex={0}>
        <span className="sr-only">Small seeds, bold flavours, big feels, growing with purpose.</span>
        <div className="benefit-ribbon-track" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div className="benefit-ribbon-group" key={copy}>
              <span>Small seeds</span><i /><span>Bold flavours</span><i /><span>Big feels</span><i /><span>Growing with purpose</span><i />
            </div>
          ))}
        </div>
      </div>

      <section className="seed-quote">
        <Image src="/assets/seed.png" alt="" width={58} height={58} />
        <blockquote>“A seed may be tiny, but it carries the promise of growth.”</blockquote>
        <span className="eyebrow">Rooted in nature · Growing with purpose</span>
      </section>

      <section className="home-shop" id="shop">
        <div className="section-heading"><div><span className="eyebrow">{settings.homeCopy?.shopEyebrow || "Meet your new favourites"}</span><h2>{settings.homeCopy?.shopHeadingLead || "Pick your"} <em>{settings.homeCopy?.shopHeadingEmphasis || "player"}</em></h2></div><Link className="text-link" href="/shop">Shop all snacks ↗</Link></div>
        <ProductGrid products={products} listName="Home featured" />
        <div className="more-growing"><Image src="/assets/seed.png" alt="" width={54} height={54} /><div><h3>More sprouting soon</h3><p>New snacks are growing. Be first to taste them.</p></div><Link className="text-link" href="/shop#shop-search">Find your flavour ↗</Link></div>
      </section>

      <section className="story-band" id="story">
        <div className="story-copy"><span className="eyebrow">{settings.homeCopy?.storyEyebrow || "Our story"}</span><h2>{settings.homeCopy?.storyTitleLineOne || "Rooted in nature."}<br /><span>{settings.homeCopy?.storyTitleHighlight || "Growing"}</span>{settings.homeCopy?.storyTitleTail || " with purpose."}</h2><p>{settings.homeCopy?.storyDescription || "Project Beej was born from a simple belief: the smallest choices shape the biggest transformations. We celebrate nature’s humblest ingredients to inspire healthier habits, mindful living, and a deeper connection with what we eat."}</p><Link className="button button-outline" href="/about">{settings.homeCopy?.storyCta || "Read our story"}</Link></div>
        <div className="story-image"><Image src="/assets/makhana-pond.png" alt="Project Beej pouch beside a lotus pond" fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
      </section>

      <section className="pillars-section"><span className="eyebrow">Small choices. Rooted values.</span><h2>What every Beej snack stands for</h2><div className="pillars-grid">{pillars.map((pillar) => <article key={pillar.n}><div className="pillar-number">{pillar.n}</div><h3>{pillar.title}</h3><p>{pillar.body}</p></article>)}</div></section>

      <section className="squad-section">
        <div className="section-heading"><div><span className="eyebrow">Packed with personality</span><h2>Snacking is a sport.</h2></div><Link className="text-link" href="/shop">Meet the squad ↗</Link></div>
        <div className="squad-grid">
          {[{ img: "squad-lifter-hq.png", name: "The Lifter", sport: "Peri Peri" }, { img: "squad-skater-hq.png", name: "The Skater", sport: "Cheese" }, { img: "squad-runner-hq.png", name: "The Striker", sport: "Himalayan Salt & Pepper" }, { img: "squad-pickleball-hq.png", name: "The Smasher", sport: "Pudina" }].map((member) => <article key={member.name}><div><Image src={`/assets/${member.img}`} alt={`${member.name} mascot`} fill sizes="(max-width: 760px) 50vw, 25vw" /></div><span>{member.name}</span><h3>{member.sport}</h3></article>)}
        </div>
      </section>

      <section className="gallery-section" id="gallery"><div className="section-heading"><div><span className="eyebrow">Good things taste better together</span><h2>#SnackWithBeej</h2></div>{settings.instagramUrl ? <a className="text-link" href={settings.instagramUrl} target="_blank" rel="noreferrer">Follow along ↗</a> : <span className="text-link-muted">Follow along soon</span>}</div><div className="community-grid">{gallery.map((image) => <div key={image.src}><Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" /></div>)}</div></section>

      <section className="newsletter-section"><div className="newsletter-copy"><span className="eyebrow">{settings.homeCopy?.newsletterEyebrow || "A little good news"}</span><h2>{settings.homeCopy?.newsletterTitleLead || "Be first to the"} <span>{settings.homeCopy?.newsletterTitleEmphasis || "next drop."}</span></h2><p>{settings.homeCopy?.newsletterDescription || "New flavours, new snacks and the occasional mascot cameo. No spam."}</p></div><NewsletterForm /></section>
    </main>
  );
}
