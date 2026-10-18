import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BannerSlider } from "@/components/BannerSlider";
import { HeroStripes } from "@/components/HeroStripes";
import { ProductGrid } from "@/components/ProductGrid";
import { SproutVideo } from "@/components/SproutVideo";
import { getCardProducts, getRequestCachedSiteSettings } from "@/lib/storefront";
import type { BeejProduct } from "@/lib/types";
import { getPublicSiteUrl } from "@/lib/site-url";
import { escapeJsonLd } from "@/lib/product-feeds";

export const metadata: Metadata = {
  title: { absolute: "Home | Project Beej" },
  description: "Meet Project Beej, explore the current snack range, and find a new favourite.",
  ...(getPublicSiteUrl() ? { alternates: { canonical: "/" } } : {}),
};

const squad = [
  { image: "squad-lifter-hq.png", name: "The Lifter", flavour: "Peri Peri", tagline: "For when you need a kick.", handle: "peri-peri", tone: "peri" },
  { image: "squad-skater-hq.png", name: "The Skater", flavour: "Cheese", tagline: "For cruising through the afternoon.", handle: "cheese", tone: "cheese" },
  { image: "squad-runner-hq.png", name: "The Striker", flavour: "Himalayan Salt & Pepper", tagline: "For the classic play, every time.", handle: "himalayan-salt-pepper", tone: "salt-pepper" },
  { image: "squad-pickleball-hq.png", name: "The Smasher", flavour: "Pudina", tagline: "For a fresh rally between meetings.", handle: "pudina", tone: "pudina" },
];

const benefitPhrases = ["Small seeds", "Big crunch", "Flavour for the moment", "Beej in the mix"];

const gallery = [
  { src: "/assets/pudina-hands.jpg", alt: "A hand reaches for a Project Beej snack" },
  { src: "/assets/himalayan-yoga.jpg", alt: "Project Beej Himalayan Salt & Pepper pack in a lifestyle scene" },
  { src: "/assets/cheese-table.jpg", alt: "Project Beej Cheese pack on a yellow table" },
  { src: "/assets/peri-flatlay.jpg", alt: "Project Beej Peri Peri pack in a bright flat lay" },
];

const values = [
  { number: "01", title: "Nature first", body: "Built on humble, honest ingredients. Nothing you need to look up." },
  { number: "02", title: "Big on flavour", body: "Healthy shouldn't mean boring. Every snack has to earn its seasoning." },
  { number: "03", title: "Grown with purpose", body: "Small, mindful choices that add up to healthier everyday habits." },
];

async function homeData(): Promise<{
  featuredProducts: BeejProduct[];
  settings: Awaited<ReturnType<typeof getRequestCachedSiteSettings>>;
}> {
  const [settings, productResult] = await Promise.all([
    getRequestCachedSiteSettings(),
    getCardProducts(),
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
            <span className="hero-eyebrow">LIGHT · CRUNCHY · HEALTHY</span>
            <h1 id="home-title">Good things grow<br /><span>from small seeds.</span></h1>
            <p>Wholesome snacks made from nature&apos;s humblest ingredients, seasoned like they mean it.</p>
            <div className="hero-actions">
              <Link className="button button-sage" href="/shop">Shop now</Link>
              <Link className="button button-hero-outline" href="/about">Our story</Link>
            </div>
          </div>
          <BannerSlider products={featuredProducts} />
        </div>
      </section>

      <div className="benefit-ribbon artifact-benefits" role="region" aria-label="A little Beej for your snack break. Focus here or hover to pause the scrolling text." tabIndex={0}>
        <span className="sr-only">Small seeds, big crunch, flavour for the moment, Beej in the mix.</span>
        <div className="benefit-ribbon-track artifact-benefit-track" aria-hidden="true">
          {Array.from({ length: 6 }, (_, copy) => (
            <div className="benefit-ribbon-group" key={copy}>
              {benefitPhrases.map((phrase) => (
                <span className="artifact-benefit-item" key={phrase}>
                  <span>{phrase}</span><i />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="squad-section artifact-team" id="team" aria-labelledby="team-title">
        <div className="section-heading">
          <div><span className="eyebrow">Meet the team</span><h2 id="team-title">Snacking is a sport.</h2></div>
          <p className="artifact-team-intro">Every Beej flavour comes with its own athlete on the jar. Which one&apos;s on your team?</p>
        </div>
        <div className="squad-grid">
          {squad.map((member) => (
            <Link className="squad-card" data-squad-tone={member.tone} href={`/products/${member.handle}`} aria-label={`Shop ${member.flavour}`} key={member.name}>
              <div className="squad-card-art">
                <Image src={`/assets/${member.image}`} alt={`${member.name} mascot`} className="squad-card-mascot" fill sizes="(max-width: 360px) 88vw, (max-width: 560px) 50vw, (max-width: 1100px) 44vw, 24vw" />
              </div>
              <div className="squad-card-copy">
                <span>{member.name}</span>
                <h3>{member.flavour}</h3>
                <p>{member.tagline}</p>
                <span className="squad-card-link">Shop now</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-shop artifact-featured" id="shop" aria-labelledby="featured-title">
        <div className="section-heading">
          <div><h2 id="featured-title">Fall favourites</h2></div>
          <Link className="text-link" href="/shop">Shop all snacks</Link>
        </div>
        <ProductGrid products={featuredProducts} listName="Home featured" />
      </section>

      <section className="story-band artifact-story" id="story" aria-labelledby="story-title">
        <div className="story-copy">
          <h2 id="story-title">Rooted in nature. <span>Growing with purpose.</span></h2>
          <p>Project Beej was born from a simple belief: the smallest choices shape the biggest transformations. We celebrate nature&apos;s humblest ingredients to inspire healthier habits and mindful snacking.</p>
          <Link className="button button-outline" href="/about">Read our story</Link>
        </div>
        <SproutVideo />
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

    </main>
  );
}
