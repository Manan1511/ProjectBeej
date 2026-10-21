import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront", () => ({ getCardProducts: vi.fn(), getRequestCachedSiteSettings: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));

import HomePage from "./page";
import { SproutVideo } from "@/components/SproutVideo";
import { getCardProducts, getRequestCachedSiteSettings } from "@/lib/storefront";

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

type TestElementProps = { children?: ReactNode; className?: string; href?: string; "aria-label"?: string; autoPlay?: boolean; muted?: boolean; loop?: boolean; playsInline?: boolean; preload?: string; poster?: string };

function elements(node: ReactNode): Array<ReactElement<TestElementProps>> {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<TestElementProps>;
  return [element, ...elements(element.props.children)];
}

describe("homepage matches the approved artifact", () => {
  beforeEach(() => {
    vi.mocked(getCardProducts).mockResolvedValue([]);
    vi.mocked(getRequestCachedSiteSettings).mockResolvedValue({ featuredHandles: [] });
  });

  it("uses the reference hero copy and primary calls to action", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Good things grow from small seeds.");
    expect(text).toContain("LIGHT · CRUNCHY · HEALTHY");
    expect(text).toContain("Wholesome snacks made from nature's humblest ingredients, seasoned like they mean it.");
    expect(text).toMatch(/Shop now/i);
    expect(text).toMatch(/Our story/i);
  });

  it("matches the reference team, favourites, story, and values copy", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Meet the team");
    expect(text).toContain("Every Beej flavour comes with its own athlete on the jar. Which one's on your team?");
    expect(text).toContain("Fall favourites");
    expect(text).toContain("Project Beej was born from a simple belief: the smallest choices shape the biggest transformations. We celebrate nature's humblest ingredients to inspire healthier habits and mindful snacking.");
    expect(text).toContain("Built on humble, honest ingredients. Nothing you need to look up.");
    expect(text).toContain("Healthy shouldn't mean boring. Every snack has to earn its seasoning.");
    expect(text).toContain("Small, mindful choices that add up to healthier everyday habits.");
    expect(text).not.toContain(String.fromCodePoint(0x2014));
  });

  it("makes each entire player card link to its flavour product", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const cards = elements(root.props.children).filter((node) => node.props.className === "squad-card");

    expect(cards).toHaveLength(4);
    expect(cards.map((card) => card.props.href)).toEqual([
      "/products/peri-peri",
      "/products/cheese",
      "/products/himalayan-salt-pepper",
      "/products/pudina",
    ]);
    for (const card of cards) {
      expect(collectText(card.props.children).join(" ")).toContain("Shop now");
      expect(elements(card.props.children).some((node) => Boolean(node.props.href))).toBe(false);
    }
  });

  it("keeps the centered ticker continuously filled and uses the sprout video", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const nodes = elements(root.props.children);
    const tickerGroups = nodes.filter((node) => (node.props.className as string | undefined)?.split(/\s+/).includes("benefit-ribbon-group"));
    const storyVideo = nodes.find((node) => node.type === SproutVideo);

    expect(tickerGroups).toHaveLength(6);
    expect(storyVideo).toBeDefined();
  });

  it("keeps the home sections in artifact order", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const classes = topLevelClasses(root.props.children);

    const expected = [
      "artifact-home-hero",
      "artifact-benefits",
      "artifact-featured",
      "artifact-team",
      "artifact-story",
      "artifact-values",
      "artifact-community",
    ];
    const positions = expected.map((className) => classes.findIndex((value) => value.split(/\s+/).includes(className)));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(classes.some((value) => value.split(/\s+/).includes("artifact-categories"))).toBe(false);
    expect(classes.some((value) => value.split(/\s+/).includes("newsletter-section"))).toBe(false);
  });

  it("does not add unsupported nutrition, allergen, tax, or origin claims", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ");

    expect(text).not.toMatch(/\b(gluten[ -]?free|protein|fibre|fiber|jain-friendly|taxes included|made in india|free shipping)\b/i);
  });
});
