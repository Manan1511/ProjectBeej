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

export function BannerSlider({ products = [], previewMode = false }: { products?: HeroProduct[]; previewMode?: boolean }) {
  const artRef = useRef<HTMLDivElement>(null);
  const isHoveredRef = useRef(false);
  const isFocusedRef = useRef(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [preloadedHandles, setPreloadedHandles] = useState<Set<string>>(() => new Set());
  const slides = useMemo(() => createHeroSlides(products), [products]);
  const visibleSlides = getHeroProductPair(slides, rotationIndex);
  const upcomingSlides = getHeroProductPair(slides, rotationIndex + 1);
  const nextImages = upcomingSlides.filter((slide) => !visibleSlides.some((visible) => visible.handle === slide.handle));
  const nextImagesReady = nextImages.every((slide) => preloadedHandles.has(slide.handle));

  useEffect(() => {
    if (previewMode) return;
    emitCommerceEvent({ name: "view_promotion", promotion_id: "hero-1", promotion_name: "Hero banner 1", items: [] });
  }, [previewMode]);

  useEffect(() => {
    const art = artRef.current;
    if (!art || slides.length < 2) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let isVisible = typeof IntersectionObserver === "undefined";
    let stopRotation: (() => void) | null = null;

    const synchronize = () => {
      const canAnimate = isVisible && !document.hidden && !reducedMotion.matches;
      art.classList.toggle("motion-active", canAnimate);

      const shouldRotate = canAnimate && !isHoveredRef.current && !isFocusedRef.current && nextImagesReady;
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
      isHoveredRef.current = true;
      synchronize();
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      isHoveredRef.current = false;
      synchronize();
    };
    const onFocusIn = () => {
      isFocusedRef.current = true;
      synchronize();
    };
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && art.contains(event.relatedTarget)) return;
      isFocusedRef.current = false;
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
  }, [nextImagesReady, rotationIndex, slides.length]);

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
            <Image key={slide.handle} src={slide.src} alt={slide.alt} fill sizes="(max-width: 760px) 45vw, 23vw" preload={rotationIndex === 0 && index === 0} loading="eager" />
          </Link>
        ))}
      </div>
      {nextImages.map((slide) => (
        <div
          className="hero-image-preloader"
          aria-hidden="true"
          key={slide.handle}
          style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}
        >
          <Image
            src={slide.src}
            alt=""
            fill
            sizes="(max-width: 760px) 45vw, 23vw"
            loading="eager"
            onLoad={() => setPreloadedHandles((handles) => new Set(handles).add(slide.handle))}
          />
        </div>
      ))}
    </div>
  );
}
