import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SanitizedHtml } from "@/components/SanitizedHtml";
import { getShopifyPage } from "@/lib/storefront";
import { requestBuyerIp } from "@/lib/request-ip";
import { getPublicSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = { title: "Our story", description: "Rooted in nature. Growing with purpose. Meet the story and snack squad behind Project Beej.", ...(getPublicSiteUrl() ? { alternates: { canonical: "/about" } } : {}) };

const beliefs = [
  { title: "Humble ingredients", body: "Nature already did the hard work. We keep labels short and honest." },
  { title: "Mindful habits", body: "Small, everyday swaps that add up to feeling better." },
  { title: "Joy in every bite", body: "Good-for-you should still be fun. Flavour is non-negotiable." },
];

export default async function AboutPage() {
  const page = await getShopifyPage("about-us", await requestBuyerIp());
  return <main id="main-content" className="about-page">
    <section className="about-hero"><span className="eyebrow">Our story</span><h1>Rooted in nature.<br /><span>Growing</span> with purpose.</h1><p>A seed may be tiny, but it carries the promise of growth.</p></section>
    <section className="about-story"><div className="about-story-copy"><span className="eyebrow">Beej · बीज · seed</span><h2>Small beginnings<br />can grow into<br />big things.</h2><p>Project Beej was born from a simple belief: the smallest choices shape the biggest transformations. We celebrate nature’s humblest ingredients to inspire healthier habits, mindful living, and a deeper connection with what we eat.</p><p>We’re here to make the everyday snack break feel a little more joyful, one tiny seed at a time.</p></div><div className="about-story-photo"><Image src="/assets/sprout-single.jpg" alt="A small green sprout growing from the soil" fill sizes="(max-width: 760px) 100vw, 50vw" /></div></section>
    {page?.body ? <section className="native-about-copy"><span className="eyebrow">A note from Project Beej</span><h2>{page.title}</h2><SanitizedHtml html={page.body} className="rich-copy" /></section> : null}
    <section className="beliefs-section"><span className="eyebrow">The things we grow by</span><h2>What we believe</h2><div>{beliefs.map((belief, index) => <article key={belief.title}><span>0{index + 1}</span><h3>{belief.title}</h3><p>{belief.body}</p></article>)}</div></section>
    <section className="about-squad"><div><span className="eyebrow">Packed with personality</span><h2>Meet the<br />Beej squad.</h2><p>Every Beej flavour has its own character on the jar. Each one brings a little different energy to snack time.</p><Link className="button button-sage" href="/shop">Shop the range</Link></div><div className="about-mascots"><Image src="/assets/mc-lifter.png" alt="The Lifter mascot" width={180} height={180} /><Image src="/assets/mc-skater.png" alt="The Skater mascot" width={180} height={180} /><Image src="/assets/mc-runner.png" alt="The Striker mascot" width={180} height={180} /><Image src="/assets/mc-pickleball.png" alt="The Smasher mascot" width={180} height={180} /></div></section>
  </main>;
}
