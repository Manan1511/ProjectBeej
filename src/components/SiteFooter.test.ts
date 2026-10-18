import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/StorefrontSettingsProvider", () => ({
  useStorefrontSettings: (fallback: unknown = {}) => ({ settings: fallback }),
}));

import { SiteFooter } from "./SiteFooter";
import { NewsletterForm } from "./NewsletterForm";

type ElementProps = { children?: ReactNode; href?: string; className?: string };

function elements(node: ReactNode): Array<ReactElement<ElementProps>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<ElementProps>;
  return [element, ...elements(element.props.children)];
}

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!isValidElement(node)) return [];
  return collectText((node as ReactElement<ElementProps>).props.children);
}

describe("site footer reference layout", () => {
  it("pairs the opt-in banner with the four-column footer and keeps useful links", () => {
    const footer = SiteFooter({ settings: { contactEmail: "hello@projectbeej.com" } });
    const text = collectText(footer).join(" ").replace(/\s+/g, " ");
    const footerElements = elements(footer);
    const links = footerElements.filter((element) => element.props.href);
    const newsletter = renderToStaticMarkup(createElement(NewsletterForm));

    expect(footerElements.some((element) => element.props.className?.split(/\s+/).includes("footer-newsletter"))).toBe(true);
    expect(text).toContain("Be first to the next drop");
    expect(text).toContain("New flavours, new snacks and early-access offers. No spam.");
    expect(newsletter).toContain('type="checkbox" required="" name="consent"');
    expect(links).toEqual(expect.arrayContaining([
      expect.objectContaining({ props: expect.objectContaining({ href: "/shop" }) }),
      expect.objectContaining({ props: expect.objectContaining({ href: "/cart" }) }),
      expect.objectContaining({ props: expect.objectContaining({ href: "/#community" }) }),
    ]));
    expect(text).toContain("Surat, Gujarat, India");
    expect(text).toContain("© 2026 Project Beej Foods Pvt. Ltd. · Product of India");
  });
});
