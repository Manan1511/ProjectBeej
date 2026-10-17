import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("site navigation", () => {
  it("reserves the reference outline bag badge until the private cart loads", async () => {
    const markup = renderToStaticMarkup(SiteHeader());

    expect(markup).toContain('class="bag-icon"');
    expect(markup).toContain('aria-label="Bag, loading"');
    expect(markup).toContain('class="bag-count">');
    expect(markup).not.toContain("Bag <span");
  });

  it("renders the bag immediately without waiting for a server-side cart count", () => {
    const markup = renderToStaticMarkup(SiteHeader());

    expect(markup).toContain('aria-label="Bag, loading"');
    expect(markup).not.toContain('class="bag-count">0</span>');
  });
});
