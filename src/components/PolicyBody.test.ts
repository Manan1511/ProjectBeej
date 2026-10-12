import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PolicyBody } from "./PolicyBody";

describe("Shopify policy body rendering", () => {
  it("renders policy markup as sanitized HTML instead of escaped text", () => {
    const markup = renderToStaticMarkup(createElement(PolicyBody, {
      body: '<h2>Returns</h2><p>Contact <a href="https://example.com">our team</a>.</p><ul><li>Keep your receipt.</li></ul><script>alert("unsafe")</script>',
    }));

    expect(markup).toContain("<h2>Returns</h2>");
    expect(markup).toContain('<a href="https://example.com" rel="noopener noreferrer">our team</a>');
    expect(markup).toContain("<ul><li>Keep your receipt.</li></ul>");
    expect(markup).not.toContain("&lt;h2&gt;");
    expect(markup).not.toContain("<script>");
  });
});
