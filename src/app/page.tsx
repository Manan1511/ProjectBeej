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
  title: "Good things grow from small seeds.",
  description: "Meet Project Beej, explore the current snack range, and find a new favourite.",
  ...(getPublicSiteUrl() ? { alternates: { canonical: "/" } } : {}),
};

const squad = [
  { image: "squad-lifter-hq.png", name: "The Lifter", flavour: "Peri Peri", tagline: "For when you need a kick.", handle: "peri-peri", tone: "peri" },
  { image: "squad-skater-hq.png", name: "The Skater", flavour: "Cheese", tagline: "For cruising through the afternoon.", handle: "cheese", tone: "cheese" },
  { image: "squad-runner-hq.png", name: "The Striker", flavour: "Himalayan Salt & Pepper", tagline: "For the classic play, every time.", handle: "himalayan-salt-pepper", tone: "salt-pepper" },
  { image: "squad-pickleball-hq.png", name: "The Smasher", flavour: "Pudina", tagline: "For a fresh rally between meetings.", handle: "pudina", tone: "pudina" },
];

const gallery = [
  { src: "/assets/pudina-hands.jpg", alt: "A hand reaches for a Project Beej snack" },
  { src: "/assets/himalayan-yoga.jpg", alt: "Project Beej Himalayan Salt & Pepper pack in a lifestyle scene" },
  { src: "/assets/cheese-table.jpg", alt: "Project Beej Cheese pack on a yellow table" },
  { src: "/assets/peri-flatlay.jpg", alt: "Project Beej Peri Peri pack in a bright flat lay" },
];

const values = [
  { number: "01", title: "Nature first", body: "Nature gives us the seed. We add the flavour." },
  { number: "02", title: "Big on flavour", body: "Bold flavour comes first. Every seasoning earns its place." },
  { number: "03", title: "Grown with purpose", body: "Small, mindful choices help shape a brand with purpose." },
];

const collectionCards = [
  { handle: "roasted-makhana", title: "Roasted Makhana", description: "4 bold flavours", image: "/assets/pudina-pop.jpg" },
  { handle: "ready-to-roast", title: "Ready to Roast", description: "Plain makhana, your way", image: "/assets/makhana-pond.jpg" },
];

async function homeData(): Promise<{
  featuredProducts: BeejProduct[];
  settings: Awaited<ReturnType<typeof getSiteSettings>>;
}> {
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
  return {
    settings,
    featuredProducts: products.filter((product) => product.handle !== "classic-makhana").slice(0, 4),
  };
}

export default async function HomePage() {
  const { featuredProducts, settings } = await homeData();
  const siteUrl = getPublicSiteUrl();
  const organization = siteUrl ? { "@context": "https://schema.org", "@type": "Organization", name: "Project Beej", url: siteUrl, ...(settings.instagramUrl ? { sameAs: [settings.instagramUrl] } : {}), ...(settings.contactEmail ? { email: settings.contactEmail } : {}) } : null;

  return (
    <main id="main-content" className="artifact-home">
      {organization ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(organization) }} /> : null}

      <section className="hero-section artifact-home-hero" aria-labelledby="home-title">
        <HeroStripes />
        <div className="hero-inner artifact-home-inner">
          <div className="hero-copy artifact-home-copy">
            <span className="hero-eyebrow"><i aria-hidden="true" /> {settings.homeCopy?.heroEyebrow || "A little crunch. A lot of character."}</span>
            <h1 id="home-title">{settings.homeCopy?.heroTitleLineOne || "Good things"}<br /><span>{settings.homeCopy?.heroTitleLineTwo || "grow from small seeds."}</span></h1>
            <p>{settings.homeCopy?.heroDescription || "Meet the Beej snack line-up, find a flavour, and make snack time your own."}</p>
            <div className="hero-actions">
              <Link className="button button-sage" href="/shop">{settings.homeCopy?.heroShopLabel || "Shop now"}</Link>
              <Link className="button button-hero-outline" href="/about">{settings.homeCopy?.heroStoryLabel || "Our story"}</Link>
            </div>
          </div>
          <BannerSlider settings={settings} />
        </div>
      </section>

      <div className="benefit-ribbon artifact-benefits" role="region" aria-label="A little Beej for your snack break. Focus here or hover to pause the scrolling text." tabIndex={0}>
        <span className="sr-only">Small seeds, big crunch, flavour for the moment, Beej in the mix.</span>
        <div className="benefit-ribbon-track artifact-benefit-track" aria-hidden="true">
          {[0, 1].map((copy) => (
            <div className="benefit-ribbon-group" key={copy}>
              <span>Small seeds</span><i /><span>Big crunch</span><i /><span>Flavour for the moment</span><i /><span>Beej in the mix</span><i />
            </div>
          ))}
        </div>
      </div>

      <section className="squad-section artifact-team" id="team" aria-labelledby="team-title">
        <div className="section-heading">
          <div><span className="eyebrow">Meet the Beej squad</span><h2 id="team-title">Snacking is a sport.</h2></div>
          <Link className="text-link" href="/shop">Pick your player <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="squad-grid">
          {squad.map((member) => (
            <article className="squad-card" data-squad-tone={member.tone} key={member.name}>
              <div className="squad-card-art">
                <Image src={`/assets/${member.image}`} alt={`${member.name} mascot`} className="squad-card-mascot" fill sizes="(max-width: 360px) 88vw, (max-width: 560px) 50vw, (max-width: 1100px) 44vw, 24vw" />
              </div>
              <div className="squad-card-copy">
                <span>{member.name}</span>
                <h3>{member.flavour}</h3>
                <p>{member.tagline}</p>
                <Link className="squad-card-link" href={`/products/${member.handle}`} aria-label={`Shop ${member.flavour}`}>Shop now</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-shop artifact-featured" id="shop" aria-labelledby="featured-title">
        <div className="section-heading">
          <div><span className="eyebrow">A flavour for every kind of break</span><h2 id="featured-title">Find your <em>favourite.</em></h2></div>
          <Link className="text-link" href="/shop">Shop all snacks <span aria-hidden="true">↗</span></Link>
        </div>
        <ProductGrid products={featuredProducts} listName="Home featured" />
      </section>

      <section className="category-shortcuts artifact-categories" aria-label="Explore the Beej range">
        <div className="category-shortcut-grid">
          {collectionCards.map((collection) => (
            <Link className="category-shortcut" href={`/collections/${collection.handle}`} key={collection.handle}>
              <Image className="category-shortcut-photo" src={collection.image} alt="" fill sizes="(max-width: 760px) 92vw, 33vw" />
              <span className="category-shortcut-shade" aria-hidden="true" />
              <span className="category-shortcut-copy">
                <span className="category-shortcut-title">{collection.title}</span>
                <span className="category-shortcut-description">{collection.description}<span aria-hidden="true">→</span></span>
              </span>
            </Link>
          ))}
          <article className="category-shortcut category-shortcut-coming-soon">
            <span className="category-shortcut-seed"><Image src="/assets/seed.png" alt="" width={68} height={68} /></span>
            <div className="category-shortcut-coming-copy">
              <h2>More sprouting soon</h2>
              <p>New snacks are growing in the Beej kitchen.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="story-band artifact-story" id="story" aria-labelledby="story-title">
        <div className="story-copy">
          <h2 id="story-title">Rooted in nature. <span>Growing with purpose.</span></h2>
          <p>Project Beej was born from a simple belief: the smallest choices shape the biggest transformations. We celebrate mindful snacking with simple ingredients, bold flavour, and a little character.</p>
          <Link className="button button-outline" href="/about">Read our story</Link>
        </div>
        <div className="story-image artifact-story-image">
          <Image className="artifact-story-seedling" src="/assets/seedlings.jpg" alt="Young seedlings emerging from soil in warm light" width={1024} height={683} sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 980px) 40vw, 36vw" />
        </div>
      </section>

      <section className="pillars-section artifact-values" aria-labelledby="values-title">
        <h2 id="values-title">What every Beej snack stands for</h2>
        <div className="pillars-grid">
          {values.map((value) => (
            <article key={value.number}><div className="pillar-number">{value.number}</div><h3>{value.title}</h3><p>{value.body}</p></article>
          ))}
        </div>
      </section>

      <section className="gallery-section artifact-community" id="gallery" aria-labelledby="community-title">
        <div className="section-heading">
          <div><span className="eyebrow">Good things taste better together</span><h2 id="community-title">#SnackWithBeej</h2></div>
          {settings.instagramUrl ? <a className="text-link" href={settings.instagramUrl} target="_blank" rel="noreferrer">Follow along <span aria-hidden="true">↗</span></a> : <span className="text-link-muted">Follow along soon</span>}
        </div>
        <div className="community-grid">{gallery.map((image) => <div key={image.src}><Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" /></div>)}</div>
      </section>

      <section className="newsletter-section artifact-newsletter" aria-labelledby="newsletter-title">
        <div className="newsletter-copy">
          <span className="eyebrow">A little good news</span>
          <h2 id="newsletter-title">Be first to the <span>next drop.</span></h2>
          <p>{settings.homeCopy?.newsletterDescription || "New flavours, new snacks, and the occasional mascot cameo. No spam."}</p>
        </div>
        <NewsletterForm />
      </section>
    </main>
  );
}
