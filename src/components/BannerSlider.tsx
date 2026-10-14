"use client";

import { useEffect, useRef, useState } from "react";
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
  const slides = configuredSlides.length > 1
    ? configuredSlides
    : [
      ...configuredSlides,
      ...defaultSlides.filter((slide) => slide.src !== configuredSlides[0]?.src),
    ];
  const [active, setActive] = useState(0);
  const artRef = useRef<HTMLDivElement>(null);
  const lastViewedSlide = useRef(-1);
  const move = (direction: number) => setActive((current) => {
    const next = (current + direction + slides.length) % slides.length;
    emitCommerceEvent({ name: "select_promotion", promotion_id: `hero-${next + 1}`, promotion_name: `Hero banner ${next + 1}`, items: [] });
    return next;
  });

  useEffect(() => {
    if (lastViewedSlide.current === active) return;
    lastViewedSlide.current = active;
    emitCommerceEvent({ name: "view_promotion", promotion_id: `hero-${active + 1}`, promotion_name: `Hero banner ${active + 1}`, items: [] });
  }, [active]);

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

  const next = (active + 1) % slides.length;
  const primarySlide = slides[active] ?? defaultSlides[0]!;
  const secondarySlide = slides[next] ?? defaultSlides[1]!;

  return (
    <div className="hero-art artifact-hero-art" ref={artRef} role="group" aria-roledescription="carousel" aria-label="Featured Project Beej snacks">
      <div className="hero-portraits">
        <div className="hero-frame hero-frame-primary">
          <Image key={primarySlide.src} src={primarySlide.src} alt={primarySlide.alt} fill sizes="(max-width: 760px) 54vw, 30vw" preload />
        </div>
        <div className="hero-frame hero-frame-secondary">
          <Image key={secondarySlide.src} src={secondarySlide.src} alt={secondarySlide.alt} fill sizes="(max-width: 760px) 42vw, 23vw" />
        </div>
      </div>
      <div className="mascot-badge mascot-top"><Image src="/assets/squad-lifter-hq.png" alt="" fill sizes="110px" /></div>
      <div className="slider-controls artifact-slider-controls" aria-label="Hero image controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous banner">←</button>
        <span aria-live="polite" className="slider-status">{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => move(1)} aria-label="Next banner">→</button>
      </div>
    </div>
  );
}
