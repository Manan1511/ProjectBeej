"use client";

import { useState } from "react";
import Image from "next/image";
import type { SiteSettings } from "@/lib/types";

const defaultSlides = [
  { src: "/assets/pudina-pop.png", alt: "Project Beej Pudina makhana with a bright, playful product scene" },
  { src: "/assets/makhana-lotus.png", alt: "Project Beej makhana by a lotus pond" },
  { src: "/assets/makhana-pond.png", alt: "Project Beej makhana nestled among lotus leaves" },
];

export function BannerSlider({ settings }: { settings: SiteSettings }) {
  const slides = settings.slides?.length ? settings.slides : defaultSlides;
  const [active, setActive] = useState(0);
  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

  return (
    <div className="hero-art">
      <div className="hero-frame">
        <Image src={slides[active]?.src || defaultSlides[0]!.src} alt={slides[active]?.alt || defaultSlides[0]!.alt} fill sizes="(max-width: 760px) 100vw, 48vw" unoptimized priority />
      </div>
      <div className="mascot-badge mascot-top"><Image src="/assets/mascot-lifter.png" alt="" fill sizes="120px" /></div>
      <div className="mascot-badge mascot-bottom"><Image src="/assets/mascot-skater.png" alt="" fill sizes="120px" /></div>
      <div className="slider-controls" aria-label="Hero image controls">
        <button type="button" onClick={() => move(-1)} aria-label="Previous banner">←</button>
        <span aria-live="polite" className="slider-status">{String(active + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        <button type="button" onClick={() => move(1)} aria-label="Next banner">→</button>
      </div>
    </div>
  );
}
