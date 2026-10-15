"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";
import { emitCommerceEvent } from "@/lib/tracking-client";

const defaultSlides = [
  { src: "/assets/pudina-pop.jpg", alt: "Project Beej Pudina makhana with a bright, playful product scene" },
  { src: "/assets/makhana-lotus.jpg", alt: "Project Beej makhana by a lotus pond" },
  { src: "/assets/makhana-pond.jpg", alt: "Project Beej makhana nestled among lotus leaves" },
];

export function BannerSlider({ settings }: { settings: SiteSettings }) {
  const configuredSlides = settings.slides ?? [];
  const slides = [
    ...configuredSlides.slice(0, 2),
    ...defaultSlides.filter((slide) => !configuredSlides.some((configured) => configured.src === slide.src)),
  ].slice(0, 2);
  const artRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    emitCommerceEvent({ name: "view_promotion", promotion_id: "hero-1", promotion_name: "Hero banner 1", items: [] });
  }, []);

  useEffect(() => {
    const art = artRef.current;
    if (!art) return;

    let isVisible = false;
    const updateMotion = () => art.classList.toggle("motion-active", isVisible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = Boolean(entry?.isIntersecting);
      updateMotion();
    });

    observer.observe(art);
    document.addEventListener("visibilitychange", updateMotion);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateMotion);
    };
  }, []);

  const primarySlide = slides[0] ?? defaultSlides[0]!;
  const secondarySlide = slides[1] ?? defaultSlides[1]!;

  return (
    <div className="hero-art artifact-hero-art" ref={artRef} role="group" aria-label="Featured Project Beej snacks">
      <div className="hero-portraits">
        <div className="hero-frame hero-frame-primary">
          <Image key={primarySlide.src} src={primarySlide.src} alt={primarySlide.alt} fill sizes="(max-width: 760px) 54vw, 30vw" preload />
        </div>
        <div className="hero-frame hero-frame-secondary">
          <Image key={secondarySlide.src} src={secondarySlide.src} alt={secondarySlide.alt} fill sizes="(max-width: 760px) 42vw, 23vw" />
        </div>
      </div>
      <div className="mascot-badge mascot-top"><Image src="/assets/squad-lifter-hq.png" alt="" fill sizes="110px" /></div>
    </div>
  );
}
