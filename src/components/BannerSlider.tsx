"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";
import { emitCommerceEvent } from "@/lib/tracking-client";

const defaultSlides = [
  { src: "/assets/pudina-pop.png", alt: "Project Beej Pudina makhana with a bright, playful product scene" },
  { src: "/assets/makhana-lotus.png", alt: "Project Beej makhana by a lotus pond" },
  { src: "/assets/makhana-pond.png", alt: "Project Beej makhana nestled among lotus leaves" },
];

export function BannerSlider({ settings }: { settings: SiteSettings }) {
  const slides = settings.slides?.length ? settings.slides : defaultSlides;
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

  return (
    <div className="hero-art" ref={artRef}>
      <div className="hero-frame">
        <Image key={active} src={slides[active]?.src || defaultSlides[0]!.src} alt={slides[active]?.alt || defaultSlides[0]!.alt} fill sizes="(max-width: 760px) 100vw, 48vw" priority />
      </div>
      <div className="mascot-badge mascot-top"><Image src="/assets/squad-lifter-hq.png" alt="" fill sizes="120px" /></div>
      <div className="mascot-badge mascot-bottom"><Image src="/assets/squad-skater-hq.png" alt="" fill sizes="120px" /></div>
      <div className="slider-controls" aria-label="Hero image controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous banner">←</button>
        <span aria-live="polite" className="slider-status">{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => move(1)} aria-label="Next banner">→</button>
      </div>
    </div>
  );
}
