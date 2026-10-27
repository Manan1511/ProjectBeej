import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { BannerSlider } from "@/components/BannerSlider";
import { HeroStripes } from "@/components/HeroStripes";
import { ProductGrid } from "@/components/ProductGrid";
import { SproutVideo } from "@/components/SproutVideo";
import { getCardProducts, getRequestCachedSiteSettings } from "@/lib/storefront";
import type { BeejProduct, SiteSettings } from "@/lib/types";
import { getPublicSiteUrl } from "@/lib/site-url";
import { escapeJsonLd } from "@/lib/product-feeds";
import { contentFromSettings, mergeAdminContent, resolveAdminSiteSettings } from "@/lib/admin-content";

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

async function homeData(settingsOverride?: SiteSettings): Promise<{
  catalogProducts: BeejProduct[];
  settings: SiteSettings;
}> {
  const [settings, catalogProducts] = await Promise.all([
    settingsOverride ? Promise.resolve(settingsOverride) : getRequestCachedSiteSettings(),
    getCardProducts(),
  ]);
  return { settings: resolveAdminSiteSettings(settings), catalogProducts };
}

export default async function HomePage() {
  return HomePageContent();
}

export async function HomePageContent({ settingsOverride, previewMode = false }: { settingsOverride?: SiteSettings; previewMode?: boolean } = {}) {
  const data = await homeData(settingsOverride);
  const settings = settingsOverride ? resolveAdminSiteSettings(settingsOverride) : data.settings;
  const content = contentFromSettings(settings);
  const effectiveSettings = mergeAdminContent(settings as Record<string, unknown>, content) as SiteSettings;
  const featuredProducts = content.featuredHandles.flatMap((handle) => data.catalogProducts.filter((product) => product.handle === handle)).slice(0, 4);
  const safeFeaturedProducts = content.featuredHandles.length > 0 && featuredProducts.length === 0 ? data.catalogProducts.slice(0, 4) : featuredProducts;
  const homeCopy = effectiveSettings.homeCopy!;
  const visibility = effectiveSettings.visibility!;
  const siteUrl = getPublicSiteUrl();
  const organization = siteUrl ? { "@context": "https://schema.org", "@type": "Organization", name: "Project Beej", url: siteUrl, ...(effectiveSettings.instagramUrl ? { sameAs: [effectiveSettings.instagramUrl] } : {}), ...(effectiveSettings.contactEmail ? { email: effectiveSettings.contactEmail } : {}) } : null;

  return (
    <main id="main-content" className="artifact-home">
      {organization ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: escapeJsonLd(organization) }} /> : null}

      <section className="hero-section artifact-home-hero" aria-labelledby="home-title">
        <HeroStripes />
        <div className="hero-inner artifact-home-inner">
          <div className="hero-copy artifact-home-copy">
            <span className="hero-eyebrow">{homeCopy.heroEyebrow}</span>
            <h1 id="home-title">{homeCopy.heroTitleLineOne}<br /><span>{homeCopy.heroTitleLineTwo}</span></h1>
            <p>{homeCopy.heroDescription}</p>
            <div className="hero-actions">
              <Link className="button button-sage" href="/shop">{homeCopy.heroShopLabel}</Link>
              <Link className="button button-hero-outline" href="/about">{homeCopy.heroStoryLabel}</Link>
            </div>
          </div>
          <BannerSlider products={data.catalogProducts} previewMode={previewMode} />
        </div>
      </section>

      {visibility.homeRibbon ? <div className="benefit-ribbon artifact-benefits" role="region" aria-label="A little Beej for your snack break. Focus here or hover to pause the scrolling text." tabIndex={0}>
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
      </div> : null}

      {visibility.homeFeatured ? <section className="home-shop artifact-featured" id="shop" aria-labelledby="featured-title">
        <div className="section-heading">
          <div><h2 id="featured-title">{homeCopy.featuredTitle}</h2></div>
          <Link className="text-link" href="/shop">{homeCopy.featuredLinkLabel}</Link>
        </div>
        <ProductGrid products={safeFeaturedProducts} listName="Home featured" previewMode={previewMode} />
      </section> : null}

      {visibility.homeAthletes ? <section className="squad-section artifact-team" id="team" aria-labelledby="team-title">
        <div className="section-heading">
          <div><span className="eyebrow">{homeCopy.teamEyebrow}</span><h2 id="team-title">{homeCopy.teamTitle}</h2></div>
          <p className="artifact-team-intro">{homeCopy.teamDescription}</p>
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
      </section> : null}

      {visibility.homeStory ? <section className="story-band artifact-story" id="story" aria-labelledby="story-title">
        <div className="story-copy">
          <h2 id="story-title">{homeCopy.storyTitleLineOne} <span>{homeCopy.storyTitleHighlight}</span></h2>
          <p>{homeCopy.storyDescription}</p>
          <Link className="button button-outline" href="/about">{homeCopy.storyCta}</Link>
        </div>
        <SproutVideo />
      </section> : null}

      {visibility.homeValues ? <section className="pillars-section artifact-values" aria-labelledby="values-title">
        <h2 id="values-title">{homeCopy.valuesTitle}</h2>
        <div className="pillars-grid">
          {values.map((value, index) => {
            const number = index + 1;
            const title = homeCopy[`value${number === 1 ? "One" : number === 2 ? "Two" : "Three"}Title` as keyof typeof homeCopy] || value.title;
            const body = homeCopy[`value${number === 1 ? "One" : number === 2 ? "Two" : "Three"}Description` as keyof typeof homeCopy] || value.body;
            return (
            <article key={value.number}><div className="pillar-number">{value.number}</div><h3>{title}</h3><p>{body}</p></article>
            );
          })}
        </div>
      </section> : null}

      {visibility.homeCommunity ? <section className="gallery-section artifact-community" id="community" aria-labelledby="community-title">
        <div className="section-heading">
          <div><span className="eyebrow">{homeCopy.communityEyebrow}</span><h2 id="community-title">{homeCopy.communityTitle}</h2></div>
          {effectiveSettings.instagramUrl ? <a className="text-link" href={effectiveSettings.instagramUrl} target="_blank" rel="noreferrer">{homeCopy.communityLinkLabel} <span aria-hidden="true">↗</span></a> : <span className="text-link-muted">{homeCopy.communityLinkLabel}</span>}
        </div>
        <div className="community-grid">{gallery.map((image) => <div key={image.src}><Image src={image.src} alt={image.alt} fill sizes="(max-width: 760px) 50vw, 25vw" /></div>)}</div>
      </section> : null}

    </main>
  );
}
