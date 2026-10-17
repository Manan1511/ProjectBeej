import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { shouldPlaySproutVideo } from "@/components/SproutVideo";

const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("storefront motion", () => {
  it("pauses the sprout video outside the viewport or when the tab is hidden", () => {
    expect(shouldPlaySproutVideo(true, true)).toBe(true);
    expect(shouldPlaySproutVideo(false, true)).toBe(false);
    expect(shouldPlaySproutVideo(true, false)).toBe(false);
  });

  it("uses a defined branded easing curve and visibly rotates the hero background", () => {
    expect(styles).toMatch(/--ease-beej:\s*cubic-bezier\(/);
    expect(styles).toMatch(/\.hero-stripes\s*\{[^}]*animation:\s*hero-stripes-rotate 150s linear infinite/);
  });

  it("keeps the reference hero headline to two deliberate lines on desktop", () => {
    const rule = styles.match(/\.artifact-home-copy h1\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/font-size:\s*clamp\(58px,\s*5vw,\s*72px\)/);
  });

  it("constrains the homepage hero copy to the mobile viewport", () => {
    expect(styles).toMatch(/\.artifact-home-copy\s*\{[^}]*min-width:\s*0/);
    expect(styles).toMatch(/\.artifact-home-copy h1\s*\{[^}]*width:\s*100%/);
    expect(styles).toMatch(/\.artifact-home-copy > p\s*\{[^}]*width:\s*100%/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.artifact-home-copy\s*\{[^}]*align-items:\s*stretch/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.artifact-home-copy > p\s*\{[^}]*max-width:\s*320px/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*430px\)[\s\S]*?\.artifact-home-copy\s*\{[^}]*width:\s*min\(100%,\s*calc\(100vw - 32px\)\)/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*430px\)[\s\S]*?\.artifact-home-copy h1\s*\{[^}]*font-size:\s*clamp\(36px,\s*10vw,\s*40px\)/);
  });

  it("moves the brand value strip as a continuous marquee", () => {
    expect(styles).toMatch(/@keyframes benefit-ribbon-drift/);
    expect(styles).toMatch(/\.benefit-ribbon-track\s*\{[^}]*animation:\s*benefit-ribbon-drift/);
    expect(styles).toMatch(/\.benefit-ribbon:focus-within\s+\.benefit-ribbon-track\s*\{[^}]*animation-play-state:\s*paused/);
  });

  it("keeps the artifact hero field and benefit ticker animated, pausable, and reduced-motion safe", () => {
    expect(styles).toMatch(/\.artifact-home-hero\s*\{[^}]*position:\s*relative/);
    expect(styles).toMatch(/\.artifact-home-hero\s+\.hero-stripes\s*\{[^}]*animation:\s*hero-stripes-rotate 150s linear infinite/);
    expect(styles).toMatch(/\.artifact-benefit-track\s*\{[^}]*animation:\s*benefit-ribbon-drift/);
    expect(styles).toMatch(/@keyframes benefit-ribbon-drift\s*\{\s*to\s*\{\s*transform:\s*translateX\(-16\.6667%\)/);
    expect(styles).toMatch(/\.artifact-benefit-track\s*\{[^}]*align-items:\s*center/);
    expect(styles).not.toMatch(/\.artifact-team\s+\.squad-card-art::before/);
    expect(styles).toMatch(/\.artifact-team\s+\.squad-card-art\s*\{[^}]*background:\s*transparent/);
    expect(styles).not.toMatch(/\.artifact-team\s+\.squad-card-art\s+\.squad-card-mascot\s*\{[^}]*filter:\s*drop-shadow/);
    expect(styles).toMatch(/\.site-header:has\(\+ main\.artifact-home\)\s*\{[^}]*backdrop-filter:\s*blur/);
    expect(styles).toMatch(/\.artifact-benefits:focus-within\s+\.artifact-benefit-track,\s*\.artifact-benefits:hover\s+\.artifact-benefit-track\s*\{[^}]*animation-play-state:\s*paused/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.artifact-benefit-track\s*\{[^}]*animation:\s*none\s*!important/);
  });

  it("keeps the marquee loop seam as tight as the spacing between its items", () => {
    expect(styles).toMatch(/\.artifact-benefits \.benefit-ribbon-group\s*\{[^}]*gap:\s*0[^}]*padding-inline:\s*0/);
  });

  it("centers each marquee phrase in a fixed-width cell without adding a loop seam", () => {
    expect(styles).toMatch(/\.artifact-benefit-item\s*\{[^}]*display:\s*grid[^}]*flex:\s*0 0 clamp\(250px,\s*22vw,\s*310px\)[^}]*place-items:\s*center/);
    expect(styles).toMatch(/\.artifact-benefit-track\s*\{[^}]*margin-left:\s*calc\(50vw - clamp\(125px,\s*11vw,\s*155px\)\)/);
    expect(styles).toMatch(/\.artifact-benefit-item i\s*\{[^}]*position:\s*absolute[^}]*right:\s*-3px/);
    expect(styles).toMatch(/\.artifact-benefits \.benefit-ribbon-group\s*\{[^}]*gap:\s*0[^}]*padding-inline:\s*0/);
  });

  it("reserves enough space between mobile squad rows for the mascot art to clear the shop link", () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.artifact-team \.squad-grid\s*\{[^}]*row-gap:\s*clamp\(30px,\s*7vw,\s*42px\)/);
  });

  it("gives enabled buttons a clear press response", () => {
    expect(styles).toMatch(/\.button:active:not\(:disabled\)\s*\{[^}]*transform:\s*translateY\(1px\) scale\(\.98\)/);
  });

  it("lets card quantity buttons fill the capsule through the rounded ends", () => {
    const rule = styles.match(/\.artifact-featured \.product-card-quantity-stepper button,\s*\.artifact-shop-grid \.product-card-quantity-stepper button\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/flex:\s*1 1 0/);
  });

  it("turns off non-essential motion for reduced-motion preferences", () => {
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none\s*!important/);
  });

  it("keeps the story video smaller with its tall aspect ratio and green breathing room", () => {
    expect(styles).toMatch(/\.artifact-story\s*\{[^}]*min-height:\s*clamp\(820px,\s*44vw,\s*940px\)[^}]*padding-block:\s*clamp\(64px,\s*6\.25vw,\s*96px\)/);
    expect(styles).toMatch(/\.artifact-story-image\s*\{[^}]*width:\s*min\(100%,\s*360px\)[^}]*aspect-ratio:\s*9\s*\/\s*16/);
    expect(styles).toMatch(/@media\s*\(max-width:\s*760px\)[\s\S]*?\.artifact-story-image\s*\{[^}]*width:\s*min\(calc\(100% - 64px\),\s*340px\)[^}]*aspect-ratio:\s*9\s*\/\s*16/);
  });
});
