"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { BeejProduct } from "@/lib/types";
import { emitCommerceEvent } from "@/lib/tracking-client";

type HeroProduct = Pick<BeejProduct, "handle" | "title" | "images">;
type HeroSlide = { handle: string; title: string; src: string; alt: string };

const defaultProducts: HeroProduct[] = [
  { handle: "cheese", title: "Cheese", images: [{ url: "/assets/cheese-drop.jpg", alt: "Project Beej Cheese makhana jar on a bright yellow set" }] },
  { handle: "pudina", title: "Pudina", images: [{ url: "/assets/pudina-pop.jpg", alt: "Project Beej Pudina makhana jar in a colourful snack scene" }] },
  { handle: "peri-peri", title: "Peri Peri", images: [{ url: "/assets/peri-flatlay.jpg", alt: "Project Beej Peri Peri makhana pack in a bright flat lay" }] },
  { handle: "himalayan-salt-pepper", title: "Himalayan Salt & Pepper", images: [{ url: "/assets/himalayan-hand.jpg", alt: "Project Beej Himalayan Salt & Pepper makhana pack in a lifestyle scene" }] },
];

const fallbackImages = new Map(defaultProducts.map(({ handle, images }) => [handle, { src: images[0]!.url, alt: images[0]!.alt }]));
const featuredProductOrder = ["cheese", "pudina", "peri-peri", "himalayan-salt-pepper"];

export const HERO_ROTATION_INTERVAL_MS = 9000;

export function getHeroProductPair<T extends { handle: string }>(items: T[], rotationIndex: number): T[] {
  const uniqueItems = [...new Map(items.map((item) => [item.handle, item])).values()];
  if (uniqueItems.length < 2) return uniqueItems;

  const startIndex = ((rotationIndex % uniqueItems.length) + uniqueItems.length) % uniqueItems.length;
  return [uniqueItems[startIndex]!, uniqueItems[(startIndex + 1) % uniqueItems.length]!];
}

export function startHeroRotation(onAdvance: () => void): () => void {
  const timer = setInterval(onAdvance, HERO_ROTATION_INTERVAL_MS);
  return () => clearInterval(timer);
}

function createHeroSlides(products: HeroProduct[] = []): HeroSlide[] {
  const candidates = products.length > 0
    ? [...products].sort((a, b) => {
      const rank = (handle: string) => {
        const index = featuredProductOrder.indexOf(handle);
        return index === -1 ? featuredProductOrder.length : index;
      };
      return rank(a.handle) - rank(b.handle);
    })
    : defaultProducts;
  const seen = new Set<string>();

  const slides = candidates.flatMap((product) => {
    if (!product.handle || seen.has(product.handle)) return [];
    seen.add(product.handle);

    const image = product.images.find(({ url }) => Boolean(url.trim()));
    const fallback = fallbackImages.get(product.handle);
    const src = fallback?.src || image?.url;
    if (!src) return [];

    return [{
      handle: product.handle,
      title: product.title,
      src,
      alt: fallback?.alt || image?.alt.trim() || `Project Beej ${product.title} snack pack`,
    }];
  });

  return slides.length > 0 ? slides : createHeroSlides();
}

export function BannerSlider({ products = [] }: { products?: HeroProduct[] }) {
  const artRef = useRef<HTMLDivElement>(null);
  const [rotationIndex, setRotationIndex] = useState(0);
  const slides = useMemo(() => createHeroSlides(products), [products]);
  const visibleSlides = getHeroProductPair(slides, rotationIndex);

  useEffect(() => {
    emitCommerceEvent({ name: "view_promotion", promotion_id: "hero-1", promotion_name: "Hero banner 1", items: [] });
  }, []);

  useEffect(() => {
    const art = artRef.current;
    if (!art || slides.length < 2) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = typeof IntersectionObserver === "undefined";
    let isHovered = false;
    let isFocused = false;
    let stopRotation: (() => void) | null = null;

    const synchronize = () => {
      const canAnimate = isVisible && !document.hidden && !reducedMotion.matches;
      art.classList.toggle("motion-active", canAnimate);

      const shouldRotate = canAnimate && !isHovered && !isFocused;
      if (shouldRotate && !stopRotation) {
        stopRotation = startHeroRotation(() => {
          setRotationIndex((index) => (index + 1) % slides.length);
        });
      } else if (!shouldRotate && stopRotation) {
        stopRotation();
        stopRotation = null;
      }
    };

    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
        isVisible = Boolean(entry?.isIntersecting);
        synchronize();
      });
    observer?.observe(art);

    const onVisibilityChange = () => synchronize();
    const onMotionPreferenceChange = () => synchronize();
    const onPointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      isHovered = true;
      synchronize();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      isHovered = false;
      synchronize();
    };
    const onFocusIn = () => {
      isFocused = true;
      synchronize();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && art.contains(event.relatedTarget)) return;
      isFocused = false;
      synchronize();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotion.addEventListener("change", onMotionPreferenceChange);
    art.addEventListener("pointerenter", onPointerEnter);
    art.addEventListener("pointerleave", onPointerLeave);
    art.addEventListener("focusin", onFocusIn);
    art.addEventListener("focusout", onFocusOut);
    synchronize();

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      art.removeEventListener("pointerenter", onPointerEnter);
      art.removeEventListener("pointerleave", onPointerLeave);
      art.removeEventListener("focusin", onFocusIn);
      art.removeEventListener("focusout", onFocusOut);
      stopRotation?.();
      art.classList.remove("motion-active");
    };
  }, [slides.length]);

  return (
    <div className="hero-art artifact-hero-art" ref={artRef} role="group" aria-label="Featured Project Beej snacks">
      <div className="hero-portraits">
        {visibleSlides.map((slide, index) => (
          <Link
            key={index === 0 ? "primary" : "secondary"}
            className={`hero-frame hero-frame-${index === 0 ? "primary" : "secondary"}`}
            href={`/products/${slide.handle}`}
            aria-label={`View ${slide.title}`}
          >
            <Image key={slide.handle} src={slide.src} alt={slide.alt} fill sizes={index === 0 ? "(max-width: 760px) 54vw, 30vw" : "(max-width: 760px) 42vw, 23vw"} preload={rotationIndex === 0 && index === 0} />
          </Link>
        ))}
      </div>
    </div>
  );
}
