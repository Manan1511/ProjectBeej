import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";

vi.mock("@/lib/storefront", () => ({ getCardProducts: vi.fn(), getRequestCachedSiteSettings: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));

import HomePage, { HomePageContent } from "./(storefront)/page";
import { ShopCatalog } from "@/components/ShopCatalog";
import { BannerSlider } from "@/components/BannerSlider";
import { ProductGrid } from "@/components/ProductGrid";
import { getCardProducts, getRequestCachedSiteSettings } from "@/lib/storefront";

const product = (handle: string): BeejProduct => ({
  id: `gid://shopify/Product/${handle}`,
  handle,
  title: handle,
  description: "A crunchy snack.",
  productType: "Roasted Makhana",
  images: [],
  variants: [],
  price: { amount: "299.00", currencyCode: "INR" },
  availableForSale: true,
  collectionHandles: [],
  metafields: {},
  preview: false,
});

function findProductGrid(node: ReactNode): ReactElement<{ products: BeejProduct[] }> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProductGrid(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;

  const element = node as ReactElement<{ children?: ReactNode; products?: BeejProduct[] }>;
  if (element.type === ProductGrid && element.props.products) {
    return element as ReactElement<{ products: BeejProduct[] }>;
  }
  return findProductGrid(element.props.children);
}

function findBannerSlider(node: ReactNode): ReactElement<{ products: BeejProduct[] }> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findBannerSlider(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;

  const element = node as ReactElement<{ children?: ReactNode; products?: BeejProduct[] }>;
  if (element.type === BannerSlider && element.props.products) {
    return element as ReactElement<{ products: BeejProduct[] }>;
  }
  return findBannerSlider(element.props.children);
}

function collectTeamCards(node: ReactNode): Array<{ href: string | undefined; className: string }> {
  if (Array.isArray(node)) return node.flatMap(collectTeamCards);
  if (!isValidElement(node)) return [];

  const element = node as ReactElement<{ href?: string; className?: string; children?: ReactNode }>;
  const teamCard = element.props.className?.split(/\s+/).includes("squad-card")
    ? [{ href: element.props.href, className: element.props.className ?? "" }]
    : [];
  return [...teamCard, ...collectTeamCards(element.props.children)];
}

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!isValidElement(node)) return [];
  return collectText((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function collectClassElements(node: ReactNode, className: string): Array<ReactElement<{ className?: string; href?: string; src?: string; children?: ReactNode }>> {
  if (Array.isArray(node)) return node.flatMap((child) => collectClassElements(child, className));
  if (!isValidElement(node)) return [];

  const element = node as ReactElement<{ className?: string; href?: string; src?: string; children?: ReactNode }>;
  const matches = element.props.className?.split(/\s+/).includes(className) ? [element] : [];
  return [...matches, ...collectClassElements(element.props.children, className)];
}

describe("homepage featured product ordering", () => {
  beforeEach(() => {
    vi.mocked(getCardProducts).mockResolvedValue([
      product("unlisted-1"),
      product("unlisted-2"),
      product("unlisted-3"),
      product("unlisted-4"),
      product("unlisted-5"),
      product("unlisted-6"),
      product("featured-b"),
      product("featured-a"),
      product("classic-makhana"),
    ]);
    vi.mocked(getRequestCachedSiteSettings).mockResolvedValue({ featuredHandles: ["classic-makhana", "featured-a", "featured-b"] });
  });

  it("gives every mascot its own flavor copy and product link", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const text = collectText(root.props.children).join(" ").replace(/\s+/g, " ");
    const cards = collectTeamCards(root.props.children);

    expect(text).toContain("For when you need a kick.");
    expect(text).toContain("For cruising through the afternoon.");
    expect(text).toContain("For the classic play, every time.");
    expect(text).toContain("For a fresh rally between meetings.");
    expect(cards.map(({ href }) => href)).toEqual([
      "/products/peri-peri",
      "/products/cheese",
      "/products/himalayan-salt-pepper",
      "/products/pudina",
    ]);
    expect(cards.every(({ className }) => className === "squad-card")).toBe(true);
  });

  it("shows only the selected products in the saved order", async () => {
    const page = await HomePage();
    const grid = findProductGrid(page);

    expect(grid?.props.products.map(({ handle }) => handle)).toEqual([
      "classic-makhana",
      "featured-a",
      "featured-b",
    ]);
  });

  it("keeps hero rotation independent from the featured shelf selection", async () => {
    const page = await HomePage();
    const slider = findBannerSlider(page);

    expect(slider?.props.products.map(({ handle }) => handle)).toEqual([
      "unlisted-1",
      "unlisted-2",
      "unlisted-3",
      "unlisted-4",
      "unlisted-5",
      "unlisted-6",
      "featured-b",
      "featured-a",
      "classic-makhana",
    ]);
  });

  it("removes the full athlete section when the admin draft hides it", async () => {
    const page = await HomePageContent({ settingsOverride: { visibility: { homeAthletes: false } }, previewMode: true });
    const root = page as ReactElement<{ children?: ReactNode }>;
    expect(collectClassElements(root.props.children, "artifact-team")).toHaveLength(0);
    expect(collectText(root.props.children).join(" ")).not.toContain("Snacking is a sport.");
  });

  it("keeps the full catalog, including Classic Makhana, on the shop page", async () => {
    const page = await ShopCatalog({ searchParams: Promise.resolve({}) });
    const grid = findProductGrid(page);
    const handles = grid?.props.products.map(({ handle }) => handle);

    expect(handles).toHaveLength(9);
    expect(handles).toContain("classic-makhana");
  });

  it("keeps the homepage reference flow free of extra collection tiles", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const cards = collectClassElements(root.props.children, "category-shortcut");

    expect(cards).toHaveLength(0);
  });

  it("matches the story and values reference without em dashes", async () => {
    const page = await HomePage();
    const root = page as ReactElement<{ children?: ReactNode }>;
    const children = root.props.children;
    const text = collectText(children).join(" ").replace(/\s+/g, " ");

    expect(text).toContain("Project Beej was born from a simple belief: the smallest choices shape the biggest transformations.");
    expect(text).toContain("We celebrate nature's humblest ingredients to inspire healthier habits and mindful snacking.");
    expect(text).toContain("Read our story");
    expect(text).toContain("What every Beej snack stands for");
    expect(text).toContain("Built on humble, honest ingredients. Nothing you need to look up.");
    expect(text).toContain("Healthy shouldn't mean boring. Every snack has to earn its seasoning.");
    expect(text).toContain("Small, mindful choices that add up to healthier everyday habits.");
    expect(text).not.toContain(String.fromCharCode(0x2014));
    expect(collectClassElements(children, "story-image-detail")).toHaveLength(0);
  });
});
