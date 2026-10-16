import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SproutVideo, SPROUT_VIDEO_DIMENSIONS, SPROUT_VIDEO_SRC, shouldLoadSproutVideo } from "./SproutVideo";

describe("homepage sprout video", () => {
  it("keeps video playback off for reduced motion and data-saving connections", () => {
    expect(shouldLoadSproutVideo({ prefersReducedMotion: true, saveData: false })).toBe(false);
    expect(shouldLoadSproutVideo({ prefersReducedMotion: false, saveData: true })).toBe(false);
    expect(shouldLoadSproutVideo({ prefersReducedMotion: false, saveData: false, effectiveType: "2g" })).toBe(false);
  });

  it("allows playback on a regular connection", () => {
    expect(shouldLoadSproutVideo({ prefersReducedMotion: false, saveData: false, effectiveType: "4g" })).toBe(true);
  });

  it("serves a content-versioned source and does not put video bytes in the initial page HTML", () => {
    expect(SPROUT_VIDEO_SRC).toBe("/assets/seed-sprout-b22cdee8a635.mp4");
    expect(SPROUT_VIDEO_DIMENSIONS).toEqual({ width: 720, height: 1280 });

    const markup = renderToStaticMarkup(createElement(SproutVideo));
    expect(markup).toContain("A sprout growing from the soil");
    expect(markup).not.toContain("<video");
    expect(markup).not.toContain(SPROUT_VIDEO_SRC);
  });
});
