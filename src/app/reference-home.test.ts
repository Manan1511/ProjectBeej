import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront", () => ({ getProducts: vi.fn(), getSiteSettings: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));

import HomePage from "./page";
import { getProducts, getSiteSettings } from "@/lib/storefront";

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!isValidElement(node)) return [];
  return collectText((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function topLevelClasses(node: ReactNode): string[] {
  const children = Array.isArray(node) ? node : [node];
  return children.flatMap((child) => {
    if (!isValidElement(child)) return [];
    return [(child as ReactElement<{ className?: string }>).props.className ?? ""];
  });
}

describe("homepage matches the approved artifact", () => {
  beforeEach(() => {
    vi.mocked(getProducts).mockResolvedValue([]);
    vi.mocked(getSiteSettings).mockResolvedValue({ featuredHandles: [] });
  });

  it("uses the approved headline and clear primary calls to action", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Good things grow from small seeds.");
    expect(text).toMatch(/Shop now/i);
    expect(text).toMatch(/Our story/i);
  });

  it("keeps the home sections in artifact order", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const classes = topLevelClasses(root.props.children);

    const expected = [
      "artifact-home-hero",
      "artifact-benefits",
      "artifact-team",
      "artifact-featured",
      "artifact-categories",
      "artifact-story",
      "artifact-values",
      "artifact-community",
      "artifact-newsletter",
    ];
    const positions = expected.map((className) => classes.findIndex((value) => value.split(/\s+/).includes(className)));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("does not make unsupported health, nutrition, allergen, tax, or origin claims", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ");

    expect(text).not.toMatch(/\b(healthy|healthier|gluten[ -]?free|protein|fibre|fiber|jain-friendly|taxes included|made in india|free shipping)\b/i);
  });
});
