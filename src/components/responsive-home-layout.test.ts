import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("responsive home layout", () => {
  it("centers the ticker on its first item and gives the longest phrase enough room", () => {
    const track = globalStyles.match(/\.artifact-benefit-track\s*\{([^}]*)\}/)?.[1] ?? "";
    const item = globalStyles.match(/\.artifact-benefit-item\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(track).toMatch(/margin-left:\s*calc\(50vw\s*-\s*clamp\(142\.5px,\s*12\.5vw,\s*160px\)\)/);
    expect(item).toMatch(/flex:\s*0\s+0\s+clamp\(285px,\s*25vw,\s*320px\)/);
    expect(item).toMatch(/gap:\s*clamp\(28px,\s*3vw,\s*40px\)/);
  });

  it("scales the mobile squad portraits to the same visual height", () => {
    const portraitRule = globalStyles.match(/\.artifact-team \.squad-card-art \.squad-card-mascot\s*\{([^}]*)\}/)?.[1] ?? "";
    const toneRules = ["cheese", "salt-pepper"].map((tone) =>
      globalStyles.match(new RegExp(`\\.artifact-team \\.squad-card\\[data-squad-tone="${tone}"\\] \\.squad-card-mascot\\s*\\{([^}]*)\\}`))?.[1] ?? "",
    );

    expect(portraitRule).toMatch(/scale\(var\(--squad-mascot-scale,\s*1\)\)/);
    expect(toneRules.every((rule) => /--squad-mascot-scale:\s*(?:0)?\.\d+/.test(rule))).toBe(true);
  });

  it("fades homepage product cards to their alternate image on hover", () => {
    expect(globalStyles).toMatch(/\.artifact-featured \.product-card-image \.product-hover-photo\s*\{[^}]*opacity:\s*0/);
    expect(globalStyles).toMatch(/\.artifact-featured \.product-card-image:hover \.product-hover-photo\s*\{[^}]*opacity:\s*1/);
    expect(globalStyles).toMatch(/\.artifact-featured \.product-card-image:hover \.product-photo\s*\{[^}]*opacity:\s*0/);
  });

  it("keeps the mobile navigation in a symmetric three-column layout", () => {
    const navRules = [...globalStyles.matchAll(/\.nav-wrap\s*\{([^}]*)\}/g)].map((match) => match[1]);
    const logoRules = [...globalStyles.matchAll(/\.brand-mark\s*\{([^}]*)\}/g)].map((match) => match[1]);
    const lastNavRule = navRules.at(-1) ?? "";
    const lastLogoRule = logoRules.at(-1) ?? "";

    expect(lastNavRule).toMatch(/grid-template-columns:\s*minmax\(42px,\s*1fr\)\s+minmax\(90px,\s*125px\)\s+minmax\(42px,\s*1fr\)/);
    expect(lastNavRule).toMatch(/env\(safe-area-inset-left\)/);
    expect(lastNavRule).toMatch(/env\(safe-area-inset-right\)/);
    expect(lastLogoRule).toMatch(/width:\s*min\(125px,\s*100%\)/);
  });

  it("keeps hero preloads out of layout and paints them only after they load", () => {
    const preload = globalStyles.match(/\.hero-image-preloader\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(preload).toMatch(/position:\s*absolute/);
    expect(preload).toMatch(/width:\s*1px/);
    expect(preload).toMatch(/height:\s*1px/);
    expect(preload).toMatch(/overflow:\s*hidden/);
  });
});
