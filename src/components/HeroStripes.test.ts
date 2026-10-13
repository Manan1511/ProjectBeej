import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("hero background stripes", () => {
  it("starts the reference rotation without waiting for visibility JavaScript", () => {
    const rule = globalStyles.match(/\.hero-stripes\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/animation:\s*hero-stripes-rotate\s+48s\s+linear\s+infinite/);
    expect(rule).not.toMatch(/animation-play-state:\s*paused/);
  });

  it("keeps the rotating stripes covering a tall hero without moving their focal point", () => {
    const rule = globalStyles.match(/\.hero-stripes\s*\{([^}]*)\}/)?.[1] ?? "";
    const overscan = Number(rule.match(/inset:\s*-(\d+)%/)?.[1]);
    const rotationOrigin = Number(rule.match(/transform-origin:\s*(\d+(?:\.\d+)?)% 50%/)?.[1]);
    const gradientOrigin = Number(rule.match(/repeating-conic-gradient\(from 0deg at (\d+(?:\.\d+)?)% 50%/)?.[1]);
    const layerScale = 1 + 2 * overscan / 100;
    const rotationPivot = -overscan / 100 + layerScale * rotationOrigin / 100;
    const gradientPivot = -overscan / 100 + layerScale * gradientOrigin / 100;
    const verticalCoverageAtQuarterTurn = layerScale / 2 - Math.abs(rotationPivot - 0.5);

    expect(rotationPivot).toBeCloseTo(0.822, 2);
    expect(gradientPivot).toBeCloseTo(0.822, 2);
    expect(verticalCoverageAtQuarterTurn).toBeGreaterThanOrEqual(1.5);
  });
});
