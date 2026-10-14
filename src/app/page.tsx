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
  { image: "squad-lifter-hq.png", name: "The Lifter", flavour: "Peri Peri" },
  { image: "squad-skater-hq.png", name: "The Skater", flavour: "Cheese" },
  { image: "squad-runner-hq.png", name: "The Striker", flavour: "Himalayan Salt & Pepper" },
  { image: "squad-pickleball-hq.png", name: "The Smasher", flavour: "Pudina" },
];

const gallery = [
  { src: "/assets/pudina-hands.jpg", alt: "A hand reaches for a Project Beej snack" },
  { src: "/assets/himalayan-yoga.jpg", alt: "Project Beej Himalayan Salt & Pepper pack in a lifestyle scene" },
  { src: "/assets/cheese-table.jpg", alt: "Project Beej Cheese pack on a yellow table" },
  { src: "/assets/peri-flatlay.jpg", alt: "Project Beej Peri Peri pack in a bright flat lay" },
];

const values = [
  { number: "01", title: "Start with a seed", body: "A small idea can make room for something new." },
  { number: "02", title: "Make it memorable", body: "Good flavour and a little character belong at the same table." },
  { number: "03", title: "Grow together", body: "The best snack breaks leave space for one more person." },
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

function getCollectionShortcuts(products: BeejProduct[]) {
  const handles = Array.from(new Set(products.flatMap((product) => product.collectionHandles))).slice(0, 3);
  return handles.map((handle) => {
    const product = products.find((item) => item.collectionHandles.includes(handle));
    const title = handle
      .split(/[-_]/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    return { handle, title, image: product?.images[0] };
  });
}

export default async function HomePage() {
  const { products, settings } = await homeData();
  const siteUrl = getPublicSiteUrl();
  const organization = siteUrl ? { "@context": "https://schema.org", "@type": "Organization", name: "Project Beej", url: siteUrl, ...(settings.instagramUrl ? { sameAs: [settings.instagramUrl] } : {}), ...(settings.contactEmail ? { email: settings.contactEmail } : {}) } : null;
  const collections = getCollectionShortcuts(products);

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
            <article key={member.name}>
              <div><Image src={`/assets/${member.image}`} alt={`${member.name} mascot`} fill sizes="(max-width: 640px) 50vw, (max-width: 980px) 25vw, 22vw" /></div>
              <span>{member.name}</span>
              <h3>{member.flavour}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="home-shop artifact-featured" id="shop" aria-labelledby="featured-title">
        <div className="section-heading">
          <div><span className="eyebrow">A flavour for every kind of break</span><h2 id="featured-title">Find your <em>favourite.</em></h2></div>
          <Link className="text-link" href="/shop">Shop all snacks <span aria-hidden="true">↗</span></Link>
        </div>
        <ProductGrid products={products} listName="Home featured" />
        <div className="more-growing">
          <Image src="/assets/seed.png" alt="" width={54} height={54} />
          <div><h3>More growing soon</h3><p>New things are taking shape. Stay close for the next drop.</p></div>
          <Link className="text-link" href="/shop#shop-search">Explore the range <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="category-shortcuts artifact-categories" aria-labelledby="categories-title">
        <div className="section-heading">
          <div><span className="eyebrow">Pick a path</span><h2 id="categories-title">Good things, this way.</h2></div>
          <Link className="text-link" href="/shop">Browse the shop <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="category-shortcut-grid">
          {collections.length ? collections.map((collection) => (
            <Link className="category-shortcut" href={`/collections/${encodeURIComponent(collection.handle)}`} key={collection.handle}>
              <span className="category-shortcut-image">
                {collection.image ? <Image src={collection.image.url} alt={collection.image.alt} fill sizes="(max-width: 760px) 90vw, 33vw" /> : null}
              </span>
              <span className="category-shortcut-copy"><span>Explore collection</span><strong>{collection.title}</strong><span aria-hidden="true">↗</span></span>
            </Link>
          )) : (
            <Link className="category-shortcut category-shortcut-featured" href="/shop">
              <span className="category-shortcut-image"><Image src="/assets/pudina-pop.jpg" alt="Project Beej snack pack in a bright product scene" fill sizes="(max-width: 760px) 90vw, 50vw" /></span>
              <span className="category-shortcut-copy"><span>See what is in store</span><strong>Shop the current range</strong><span aria-hidden="true">↗</span></span>
            </Link>
          )}
        </div>
      </section>

      <section className="story-band artifact-story" id="story" aria-labelledby="story-title">
        <div className="story-copy">
          <span className="eyebrow">Our story</span>
          <h2 id="story-title">Rooted in nature.<br /><span>Growing with purpose.</span></h2>
          <p>{settings.homeCopy?.storyDescription || "Good things can start small. Project Beej is growing a snack brand with flavour, character, and room for everyone at the table."}</p>
          <Link className="button button-outline" href="/about">Get to know us</Link>
        </div>
        <div className="story-image artifact-story-image">
          <Image src="/assets/seedlings.jpg" alt="Young green seedlings growing in soil" fill sizes="(max-width: 760px) 100vw, 50vw" />
          <Image className="story-image-detail" src="/assets/makhana-pond.jpg" alt="Project Beej makhana beside a lotus pond" fill sizes="(max-width: 760px) 42vw, 22vw" />
        </div>
      </section>

      <section className="pillars-section artifact-values" aria-labelledby="values-title">
        <span className="eyebrow">Small beginnings. Good company.</span>
        <h2 id="values-title">What we want to grow.</h2>
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
