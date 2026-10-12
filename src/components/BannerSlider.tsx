"use client";

import { useEffect, useRef, useState } from "react";
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
  const artRef = useRef<HTMLDivElement>(null);
  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

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
        <Image key={active} src={slides[active]?.src || defaultSlides[0]!.src} alt={slides[active]?.alt || defaultSlides[0]!.alt} fill sizes="(max-width: 760px) 100vw, 48vw" unoptimized priority />
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
