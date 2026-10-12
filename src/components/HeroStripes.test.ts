import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("hero background stripes", () => {
  it("starts the reference rotation without waiting for visibility JavaScript", () => {
    const rule = globalStyles.match(/\.hero-stripes\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(rule).toMatch(/animation:\s*hero-stripes-rotate\s+48s\s+linear\s+infinite/);
    expect(rule).not.toMatch(/animation-play-state:\s*paused/);
  });
});
