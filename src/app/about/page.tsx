import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicSiteUrl } from "@/lib/site-url";

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

export default function AboutPage() {
  return <main id="main-content" className="about-page artifact-about">
    <section className="about-hero artifact-about-hero" aria-labelledby="about-title">
      <Image className="about-hero-image" src="/assets/seedlings.jpg" alt="Seedlings growing at different stages in rich soil" fill sizes="100vw" preload />
      <div className="about-hero-shade" />
      <div className="artifact-about-hero-copy">
        <span className="eyebrow">Our story</span>
        <h1 id="about-title">Rooted in<br />nature. Growing<br /><span>with purpose.</span></h1>
      </div>
    </section>

    <section className="artifact-about-intro" aria-labelledby="about-beginnings">
      <div className="artifact-about-intro-copy">
        <h2 id="about-beginnings">A seed may be tiny,<br />but it carries the<br /><span>promise of growth.</span></h2>
        <div className="artifact-about-intro-prose">
          <p>“Beej” means seed. Project Beej was born from the belief that the smallest choices shape the biggest transformations, including what you reach for when the 4pm hunger hits.</p>
          <p>By celebrating nature&apos;s most humble ingredients, we hope to inspire healthier habits, mindful living, and a deeper connection with what we eat.</p>
          <p>Our journey begins with a purpose that goes far beyond the snack bag.</p>
        </div>
      </div>
      <div className="artifact-about-gallery" aria-label="Project Beej in nature, at home, and at play">
        {storyPhotos.map((photo) => <figure key={photo.image}>
          <Image src={`/assets/${photo.image}`} alt={photo.alt} fill sizes="(max-width: 760px) 90vw, (max-width: 1200px) 32vw, 480px" />
        </figure>)}
      </div>
    </section>

    <section className="artifact-about-seed-banner" aria-labelledby="about-seed-title">
      <Image src="/assets/sprout-single.jpg" alt="A young green sprout rising from rich soil" fill sizes="(max-width: 760px) 100vw, 90vw" />
      <div className="artifact-about-seed-shade" />
      <div className="artifact-about-seed-copy">
        <span className="eyebrow">Beej · बीज · Seed</span>
        <h2 id="about-seed-title">Small seeds.<br />Big feels.</h2>
      </div>
    </section>

    <section className="beliefs-section artifact-about-beliefs" aria-labelledby="beliefs-title">
      <h2 id="beliefs-title">What we believe</h2>
      <div className="artifact-about-belief-grid">
        {beliefs.map((belief, index) => <article key={belief.title}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <h3>{belief.title}</h3>
          <p>{belief.body}</p>
        </article>)}
      </div>
    </section>

    <section className="artifact-about-cta" aria-labelledby="about-cta-title">
      <div className="artifact-about-cta-mascots" aria-hidden="true">
        {mascots.map((mascot) => <Image key={mascot.image} src={`/assets/${mascot.image}`} alt="" width={180} height={180} sizes="(max-width: 760px) 30vw, 180px" />)}
      </div>
      <h2 id="about-cta-title">Plant a better snack habit</h2>
      <Link className="button button-dark" href="/shop">Shop the range</Link>
    </section>
  </main>;
}
