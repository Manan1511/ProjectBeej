import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

describe("storefront motion", () => {
  it("uses a defined branded easing curve and visibly rotates the hero background", () => {
    expect(styles).toMatch(/--ease-beej:\s*cubic-bezier\(/);
    expect(styles).toMatch(/\.hero-stripes\s*\{[^}]*animation:\s*hero-stripes-rotate 48s linear infinite/);
  });

  it("moves the brand value strip as a continuous marquee", () => {
    expect(styles).toMatch(/@keyframes benefit-ribbon-drift/);
    expect(styles).toMatch(/\.benefit-ribbon-track\s*\{[^}]*animation:\s*benefit-ribbon-drift/);
    expect(styles).toMatch(/\.benefit-ribbon:focus-within\s+\.benefit-ribbon-track\s*\{[^}]*animation-play-state:\s*paused/);
  });

  it("keeps the artifact hero field and benefit ticker animated, pausable, and reduced-motion safe", () => {
    expect(styles).toMatch(/\.artifact-home-hero\s*\{[^}]*position:\s*relative/);
    expect(styles).toMatch(/\.artifact-home-hero\s+\.hero-stripes\s*\{[^}]*animation:\s*hero-stripes-rotate 48s linear infinite/);
    expect(styles).toMatch(/\.artifact-benefit-track\s*\{[^}]*animation:\s*benefit-ribbon-drift/);
    expect(styles).toMatch(/\.artifact-benefits:focus-within\s+\.artifact-benefit-track,\s*\.artifact-benefits:hover\s+\.artifact-benefit-track\s*\{[^}]*animation-play-state:\s*paused/);
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.artifact-benefit-track\s*\{[^}]*animation:\s*none\s*!important/);
  });

  it("gives enabled buttons a clear press response", () => {
    expect(styles).toMatch(/\.button:active:not\(:disabled\)\s*\{[^}]*transform:\s*translateY\(1px\) scale\(\.98\)/);
  });

  it("turns off non-essential motion for reduced-motion preferences", () => {
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*animation:\s*none\s*!important/);
  });
});
