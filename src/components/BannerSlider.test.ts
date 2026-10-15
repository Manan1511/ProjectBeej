import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { SiteSettings } from "@/lib/types";
import { BannerSlider } from "./BannerSlider";

describe("hero portraits", () => {
  it("renders only the first two Shopify-managed banners without carousel controls", () => {
    const settings: SiteSettings = {
      slides: [
        { src: "/assets/first.jpg", alt: "First snack scene" },
        { src: "/assets/second.jpg", alt: "Second snack scene" },
        { src: "/assets/third.jpg", alt: "Third snack scene" },
      ],
    };

    const markup = renderToStaticMarkup(createElement(BannerSlider, { settings }));

    expect(markup).toContain('alt="First snack scene"');
    expect(markup).toContain('alt="Second snack scene"');
    expect(markup).not.toContain('alt="Third snack scene"');
    expect(markup).toContain('aria-label="Featured Project Beej snacks"');
    expect(markup).not.toContain('aria-roledescription="carousel"');
    expect(markup).not.toContain('aria-label="Previous banner"');
    expect(markup).not.toContain('aria-label="Next banner"');
    expect(markup).not.toContain('class="slider-status"');
  });

  it("pairs one configured slide with a local portrait instead of duplicating the same image", () => {
    const settings: SiteSettings = {
      slides: [{ src: "/assets/merchant-slide.jpg", alt: "Merchant featured snack" }],
    };

    const markup = renderToStaticMarkup(createElement(BannerSlider, { settings }));

    expect(markup.match(/alt="Merchant featured snack"/g)).toHaveLength(1);
    expect(markup).toContain('alt="Project Beej Pudina makhana with a bright, playful product scene"');
  });
});
