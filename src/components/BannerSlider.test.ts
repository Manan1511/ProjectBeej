import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ComponentType } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";
import * as BannerSliderModule from "./BannerSlider";

const { BannerSlider } = BannerSliderModule;

const products: BeejProduct[] = [
  { id: "gid://shopify/Product/cheese", handle: "cheese", title: "Cheese", description: "Cheese makhana.", productType: "Roasted Makhana", images: [{ url: "/assets/cheese-drop.jpg", alt: "Cheese snack jar" }], variants: [], price: { amount: "299.00", currencyCode: "INR" }, availableForSale: true, collectionHandles: [], metafields: {}, preview: false },
  { id: "gid://shopify/Product/pudina", handle: "pudina", title: "Pudina", description: "Pudina makhana.", productType: "Roasted Makhana", images: [{ url: "/assets/pudina-pop.jpg", alt: "Pudina snack jar" }], variants: [], price: { amount: "299.00", currencyCode: "INR" }, availableForSale: true, collectionHandles: [], metafields: {}, preview: false },
  { id: "gid://shopify/Product/peri-peri", handle: "peri-peri", title: "Peri Peri", description: "Peri Peri makhana.", productType: "Roasted Makhana", images: [{ url: "/assets/peri-flatlay.jpg", alt: "Peri Peri snack jar" }], variants: [], price: { amount: "299.00", currencyCode: "INR" }, availableForSale: true, collectionHandles: [], metafields: {}, preview: false },
  { id: "gid://shopify/Product/himalayan-salt-pepper", handle: "himalayan-salt-pepper", title: "Himalayan Salt & Pepper", description: "Himalayan Salt and Pepper makhana.", productType: "Roasted Makhana", images: [{ url: "/assets/himalayan-hand.jpg", alt: "Himalayan Salt & Pepper snack jar" }], variants: [], price: { amount: "299.00", currencyCode: "INR" }, availableForSale: true, collectionHandles: [], metafields: {}, preview: false },
];

type HeroRotationApi = {
  getHeroProductPair?: (items: Array<{ handle: string }>, rotationIndex: number) => Array<{ handle: string }>;
  startHeroRotation?: (onAdvance: () => void) => () => void;
  HERO_ROTATION_INTERVAL_MS?: number;
};

const rotationApi = BannerSliderModule as typeof BannerSliderModule & HeroRotationApi;

describe("hero portraits", () => {
  it("renders the Cheese and Pudina reference portraits without carousel controls", () => {
    const markup = renderToStaticMarkup(createElement(BannerSlider));

    expect(markup).toContain('alt="Project Beej Cheese makhana jar on a bright yellow set"');
    expect(markup).toContain('alt="Project Beej Pudina makhana jar in a colourful snack scene"');
    expect(markup).toContain("cheese-drop.jpg");
    expect(markup).toContain("pudina-pop.jpg");
    expect(markup).toContain('aria-label="Featured Project Beej snacks"');
    expect(markup).not.toContain('aria-roledescription="carousel"');
    expect(markup).not.toContain('aria-label="Previous banner"');
    expect(markup).not.toContain('aria-label="Next banner"');
    expect(markup).not.toContain('class="slider-status"');
  });

  it("shows two distinct frames and omits the floating mascot badge", () => {
    const markup = renderToStaticMarkup(createElement(BannerSlider));

    expect(markup.match(/class="hero-frame /g)).toHaveLength(2);
    expect(markup).not.toContain("mascot-badge");
  });

  it("links both visible product portraits to their own distinct product pages", () => {
    const SliderWithProducts = BannerSlider as unknown as ComponentType<{ products: BeejProduct[] }>;
    const markup = renderToStaticMarkup(createElement(SliderWithProducts, { products }));
    const handles = [...markup.matchAll(/href="\/products\/([^"]+)"/g)].map((match) => match[1]);

    expect(handles).toEqual(["cheese", "pudina"]);
    expect(new Set(handles).size).toBe(handles.length);
  });

  it("keeps the Cheese and Pudina portraits first when product data arrives in another order", () => {
    const SliderWithProducts = BannerSlider as unknown as ComponentType<{ products: BeejProduct[] }>;
    const markup = renderToStaticMarkup(createElement(SliderWithProducts, { products: [...products].reverse() }));
    const handles = [...markup.matchAll(/href="\/products\/([^"]+)"/g)].map((match) => match[1]);

    expect(handles).toEqual(["cheese", "pudina"]);
  });

  it("shows only one portrait when only one product is available", () => {
    const SliderWithProducts = BannerSlider as unknown as ComponentType<{ products: BeejProduct[] }>;
    const markup = renderToStaticMarkup(createElement(SliderWithProducts, { products: [products[0]!] }));
    const handles = [...markup.matchAll(/href="\/products\/([^"]+)"/g)].map((match) => match[1]);

    expect(handles).toEqual(["cheese"]);
    expect(markup.match(/class="hero-frame /g)).toHaveLength(1);
  });

  it("advances through different adjacent product pairs without duplicates", () => {
    const getHeroProductPair = rotationApi.getHeroProductPair;
    expect(getHeroProductPair).toBeTypeOf("function");
    if (!getHeroProductPair) return;

    const pairs = Array.from({ length: 4 }, (_, index) => getHeroProductPair(products, index).map(({ handle }) => handle));

    expect(pairs).toEqual([
      ["cheese", "pudina"],
      ["pudina", "peri-peri"],
      ["peri-peri", "himalayan-salt-pepper"],
      ["himalayan-salt-pepper", "cheese"],
    ]);
    expect(pairs.every((pair) => pair.length === new Set(pair).size)).toBe(true);
  });

  it("rotates on a slower repeating interval and stops when cleaned up", () => {
    const startHeroRotation = rotationApi.startHeroRotation;
    const interval = rotationApi.HERO_ROTATION_INTERVAL_MS;
    expect(startHeroRotation).toBeTypeOf("function");
    expect(interval).toBeGreaterThanOrEqual(8000);
    if (!startHeroRotation || !interval) return;

    vi.useFakeTimers();
    try {
      const onAdvance = vi.fn();
      const stop = startHeroRotation(onAdvance);

      vi.advanceTimersByTime(interval - 1);
      expect(onAdvance).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(onAdvance).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(interval);
      expect(onAdvance).toHaveBeenCalledTimes(2);
      stop();
      vi.advanceTimersByTime(interval * 2);
      expect(onAdvance).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
