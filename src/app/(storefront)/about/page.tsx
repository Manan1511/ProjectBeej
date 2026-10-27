import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";
import { getRequestCachedSiteSettings } from "@/lib/storefront";
import { contentFromSettings, resolveAdminSiteSettings } from "@/lib/admin-content";
import type { SiteSettings } from "@/lib/types";

export const metadata: Metadata = {
  title: "Our story",
  description: "The story of Project Beej, a small seed of an idea growing into a more mindful way to snack.",
  ...(getPublicSiteUrl() ? { alternates: { canonical: "/about" } } : {}),
};

const storyPhotos = [
  { image: "makhana-pond.jpg", alt: "Project Beej ready-to-roast makhana beside a lotus pond" },
  { image: "himalayan-yoga.jpg", alt: "Project Beej Himalayan Salt and Pepper makhana beside a yoga mat" },
  { image: "pudina-pop.jpg", alt: "Project Beej Pudina makhana with its playful mascot" },
];

const beliefs = [
  { title: "Humble ingredients", body: "Nature already did the hard work. We keep labels short and honest." },
  { title: "Mindful habits", body: "Small, everyday swaps that add up to feeling better." },
  { title: "Joy in every bite", body: "Good-for-you should still be fun. Flavour is non-negotiable." },
];

const mascots = [
  { image: "squad-lifter-hq.png", alt: "The Lifter mascot" },
  { image: "squad-skater-hq.png", alt: "The Skater mascot" },
];

export default async function AboutPage() {
  return AboutPageContent();
}

export async function AboutPageContent({ settingsOverride }: { settingsOverride?: SiteSettings } = {}) {
  const settings = resolveAdminSiteSettings(settingsOverride || await getRequestCachedSiteSettings());
  const content = contentFromSettings(settings);
  const copy = content.aboutCopy;
  const visibility = content.visibility;
  return <main id="main-content" className="about-page artifact-about">
    <section className="about-hero artifact-about-hero" aria-labelledby="about-title">
      <Image className="about-hero-image" src="/assets/seedlings.jpg" alt="Seedlings growing at different stages in rich soil" fill sizes="100vw" preload />
      <div className="about-hero-shade" />
      <div className="artifact-about-hero-copy artifact-about-content-align">
        <span className="eyebrow">{copy.heroEyebrow}</span>
        <h1 id="about-title">{copy.heroTitleLineOne}<br />{copy.heroTitleLineTwo}</h1>
      </div>
    </section>

    {visibility.aboutIntroGallery ? <section className="artifact-about-intro" aria-labelledby="about-beginnings">
      <div className="artifact-about-intro-copy artifact-about-content-align">
        <h2 id="about-beginnings">{copy.introTitleLineOne}<br />{copy.introTitleLineTwo}<br /><span>{copy.introTitleEmphasis}</span></h2>
        <div className="artifact-about-intro-prose">
          <p>{copy.introParagraphOne}</p>
          <p>{copy.introParagraphTwo}</p>
          <p>{copy.introParagraphThree}</p>
        </div>
      </div>
      <div className="artifact-about-gallery artifact-about-content-align" aria-label="Project Beej in nature, at home, and at play">
        {storyPhotos.map((photo) => <figure key={photo.image}>
          <Image src={`/assets/${photo.image}`} alt={photo.alt} fill sizes="(max-width: 760px) 90vw, (max-width: 1200px) 32vw, 480px" />
        </figure>)}
      </div>
    </section> : null}

    {visibility.aboutSeedBanner ? <section className="artifact-about-seed-banner artifact-about-content-align" aria-labelledby="about-seed-title">
      <Image src="/assets/sprout-single.jpg" alt="A young green sprout rising from rich soil" fill sizes="(max-width: 760px) 100vw, 90vw" />
      <div className="artifact-about-seed-shade" />
      <div className="artifact-about-seed-copy">
        <span className="eyebrow">{copy.seedEyebrow}</span>
        <h2 id="about-seed-title">{copy.seedTitleLineOne}<br />{copy.seedTitleLineTwo}</h2>
      </div>
    </section> : null}

    {visibility.aboutBeliefs ? <section className="beliefs-section artifact-about-beliefs" aria-labelledby="beliefs-title">
      <h2 id="beliefs-title">{copy.beliefsTitle}</h2>
      <div className="artifact-about-belief-grid">
        {beliefs.map((belief, index) => {
          const number = index + 1;
          const label = number === 1 ? "One" : number === 2 ? "Two" : "Three";
          return <article key={belief.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <h3>{copy[`belief${label}Title` as keyof typeof copy]}</h3>
          <p>{copy[`belief${label}Description` as keyof typeof copy]}</p>
        </article>;
        })}
      </div>
    </section> : null}

    {visibility.aboutClosing ? <section className="artifact-about-cta" aria-labelledby="about-cta-title">
      <div className="artifact-about-cta-mascots" aria-hidden="true">
        {mascots.map((mascot) => <Image key={mascot.image} src={`/assets/${mascot.image}`} alt="" width={180} height={180} sizes="(max-width: 760px) 30vw, 180px" />)}
      </div>
      <h2 id="about-cta-title">{copy.closingTitle}</h2>
      <Link className="button button-dark" href="/shop">{copy.closingButtonLabel}</Link>
    </section> : null}
  </main>;
}
