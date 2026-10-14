import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SanitizedHtml } from "@/components/SanitizedHtml";
import { getShopifyPage } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Our story",
  description: "Meet Project Beej, read the story behind the brand, and get to know the mascot lineup.",
  ...(getPublicSiteUrl() ? { alternates: { canonical: "/about" } } : {}),
};

const beliefs = [
  { title: "Small beginnings", body: "Good things can start with one simple idea." },
  { title: "Flavour with character", body: "We like our snack breaks with a little personality." },
  { title: "Room at the table", body: "The best moments leave space for one more person." },
];

const mascots = [
  { image: "squad-lifter-hq.png", alt: "The Lifter mascot" },
  { image: "squad-skater-hq.png", alt: "The Skater mascot" },
  { image: "squad-runner-hq.png", alt: "The Striker mascot" },
  { image: "squad-pickleball-hq.png", alt: "The Smasher mascot" },
];

export default async function AboutPage() {
  const page = await getShopifyPage("about-us", await requestBuyerIp());
  return <main id="main-content" className="about-page artifact-about">
    <section className="about-hero artifact-about-hero" aria-labelledby="about-title">
      <Image className="about-hero-image" src="/assets/seedlings.jpg" alt="Young green seedlings growing in soil" fill sizes="100vw" preload />
      <div className="about-hero-shade" />
      <div className="artifact-about-hero-copy">
        <span className="eyebrow">Our story</span>
        <h1 id="about-title">Rooted in nature.<br /><span>Growing with purpose.</span></h1>
        <p>A story that starts small, and keeps growing.</p>
        <Link className="button button-sage" href="/shop">Shop the range</Link>
      </div>
      <Image className="about-hero-seed" src="/assets/seed.png" alt="" width={68} height={68} />
    </section>

    <section className="about-story artifact-about-story" aria-labelledby="about-beginnings">
      <div className="about-story-copy">
        <span className="eyebrow">A little about us</span>
        <h2 id="about-beginnings">Small beginnings<br />can grow into<br />big things.</h2>
        <p>Project Beej is a snack brand built around one simple idea: good things grow from small beginnings. We bring flavour and character to everyday snack moments, and keep making space for new ideas.</p>
        <p>This is the story so far. We are glad you are here for the next page.</p>
      </div>
      <div className="about-story-photo artifact-about-story-photo">
        <Image src="/assets/seedlings.jpg" alt="Young seedlings in a patch of soil" fill sizes="(max-width: 760px) 100vw, 50vw" />
        <Image className="about-story-photo-detail" src="/assets/makhana-pond.jpg" alt="Project Beej makhana beside a lotus pond" fill sizes="(max-width: 760px) 44vw, 22vw" />
      </div>
    </section>

    {page?.body ? <section className="native-about-copy artifact-about-native"><span className="eyebrow">A note from Project Beej</span><h2>{page.title}</h2><SanitizedHtml html={page.body} className="rich-copy" /></section> : null}

    <section className="beliefs-section artifact-about-values" aria-labelledby="beliefs-title">
      <span className="eyebrow">The things we grow by</span>
      <h2 id="beliefs-title">A few things we believe.</h2>
      <div>{beliefs.map((belief, index) => <article key={belief.title}><span>0{index + 1}</span><h3>{belief.title}</h3><p>{belief.body}</p></article>)}</div>
    </section>

    <section className="about-squad artifact-about-squad">
      <div><span className="eyebrow">Packed with personality</span><h2>Meet the<br />Beej squad.</h2><p>Every mascot brings its own character to the Beej snack line-up.</p><Link className="button button-sage" href="/shop">Shop the current range</Link></div>
      <div className="about-mascots">{mascots.map((mascot) => <Image key={mascot.image} src={`/assets/${mascot.image}`} alt={mascot.alt} width={180} height={180} />)}</div>
    </section>
  </main>;
}
