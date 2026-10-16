import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Image from "next/image";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront", () => ({ getCardProducts: vi.fn(), getShopifyPage: vi.fn(), getShopifyCartCount: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));
vi.mock("@/lib/cart-cookie", () => ({ readStoredCartId: vi.fn(async () => "cart-id") }));

import ShopPage from "./shop/page";
import AboutPage from "./about/page";
import { ProductGrid } from "@/components/ProductGrid";
import { CartCountLink } from "@/components/CartCountLink";
import { ShopEditorialSections } from "@/components/ShopEditorialSections";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { MobileNav } from "@/components/MobileNav";
import { SiteHeader } from "@/components/SiteHeader";
import { getCardProducts, getShopifyCartCount, getShopifyPage } from "@/lib/storefront";

function childrenOf(node: ReactNode): ReactNode | undefined {
  if (!isValidElement(node)) return undefined;
  return (node as ReactElement<{ children?: ReactNode }>).props.children;
}

function findElements(node: ReactNode, type: unknown): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, type));
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [
    ...(element.type === type ? [element] : []),
    ...findElements(element.props.children, type),
  ];
}

function collectText(node: ReactNode): string[] {
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (!isValidElement(node)) return [];
  return collectText(childrenOf(node));
}

function collectClasses(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(collectClasses);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ className?: string; children?: ReactNode }>;
  return [element.props.className ?? "", ...collectClasses(element.props.children)];
}

function collectLinks(node: ReactNode): Array<{ href?: string; label: string; onClick?: unknown }> {
  if (Array.isArray(node)) return node.flatMap(collectLinks);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ href?: string; children?: ReactNode; onClick?: unknown }>;
  const ownLink = element.props.href
    ? [{ href: element.props.href, label: collectText(element.props.children).join(" ").trim(), onClick: element.props.onClick }]
    : [];
  return [...ownLink, ...collectLinks(element.props.children)];
}

describe("Shop and About match the approved artifact", () => {
  beforeEach(() => {
    vi.mocked(getCardProducts).mockResolvedValue([]);
    vi.mocked(getShopifyPage).mockResolvedValue(null);
    vi.mocked(getShopifyCartCount).mockResolvedValue(3);
  });

  it("keeps the shared desktop header routes and displays the live bag count", async () => {
    const header = await SiteHeader({ settings: {} });
    const links = collectLinks(header);
    const hrefs = links.map(({ href }) => href);
    const cartLink = findElements(header, CartCountLink)[0] as ReactElement<{ initialCount: number }> | undefined;

    expect(hrefs).toEqual(expect.arrayContaining(["/", "/shop", "/about"]));
    expect(cartLink?.props.initialCount).toBe(3);
    const cartMarkup = cartLink ? renderToStaticMarkup(cartLink) : "";
    expect(cartMarkup).toContain('href="/cart"');
    expect(cartMarkup).toContain('aria-label="Bag, 3 items"');
    expect(cartMarkup).toContain('class="bag-count">3</span>');
  });

  it("keeps Home, Shop, Our Story, and Bag in the mobile menu without a Contact route", () => {
    const markup = renderToStaticMarkup(createElement(MobileNav, { count: 3 }));

    expect(markup).toContain('href="/"');
    expect(markup).toContain('href="/shop"');
    expect(markup).toContain('href="/about"');
    expect(markup).toContain('href="/cart"');
    expect(markup).toContain("Bag (3)");
    expect(markup).not.toContain('href="/contact"');
  });

  it("keeps the reference Shop hero copy and compact search, filters, and sorting", async () => {
    const page = await ShopPage({ searchParams: Promise.resolve({}) });
    const children = childrenOf(page);
    const text = collectText(children).join(" ").replace(/\s+/g, " ");
    const headings = findElements(children, "h1");
    const grids = findElements(children, ProductGrid);
    const grid = grids[0] as ReactElement<{ filters?: boolean; presentation?: string; toolbar?: ReactElement<{ compact?: boolean }> }> | undefined;

    expect(headings).toHaveLength(1);
    expect(collectText(childrenOf(headings[0])).join("")).toBe("Shop all");
    expect(text).toContain("Snacks made from nature's humblest ingredients.");
    expect(text).toContain("Free shipping on orders above ₹499.");
    expect(text).not.toMatch(/Discover the current Beej range|Browse the range|Find your flavour\./);
    expect(grid?.props.filters).toBe(true);
    expect(grid?.props.presentation).toBe("shop");
    expect(grid?.props.toolbar?.type).toBe(StoreSearchForm);
    expect(grid?.props.toolbar?.props.compact).toBe(true);
    const searchMarkup = grid?.props.toolbar ? renderToStaticMarkup(grid.props.toolbar) : "";
    expect(searchMarkup).toContain("search-form-compact");
    expect(searchMarkup).toContain('aria-label="Search snacks"');
    expect(searchMarkup).not.toContain("Search the Beej pantry by flavour or snack type.");
    expect(collectClasses(children).some((value) => value.split(/\s+/).includes("artifact-shop-hero"))).toBe(true);
  });

  it("keeps category filters and sorting available on search results", async () => {
    vi.mocked(getCardProducts).mockResolvedValue([{
      id: "gid://shopify/Product/121",
      handle: "pudina",
      title: "Pudina",
      description: "A Shopify-managed product description.",
      productType: "Roasted Makhana",
      images: [],
      variants: [],
      price: { amount: "417.00", currencyCode: "INR" },
      availableForSale: true,
      collectionHandles: ["roasted-makhana"],
      metafields: {},
      preview: false,
    }]);
    const page = await ShopPage({ searchParams: Promise.resolve({ q: "pudina" }) });
    const grid = findElements(childrenOf(page), ProductGrid)[0] as ReactElement<{ filters?: boolean; products: unknown[] }> | undefined;

    expect(grid?.props.filters).toBe(true);
    expect(grid?.props.products).toHaveLength(1);
  });

  it("places the Snack spotted collage and benefits banner below the shop catalog", async () => {
    const page = await ShopPage({ searchParams: Promise.resolve({}) });
    const pageChildren = childrenOf(page);
    const orderedChildren = Array.isArray(pageChildren) ? pageChildren : [pageChildren];
    const editorialSections = ShopEditorialSections();
    const sections = findElements(childrenOf(editorialSections), "section") as Array<ReactElement<{ className?: string; children?: ReactNode }>>;
    const spottedIndex = sections.findIndex(({ props }) => props.className?.includes("shop-spotted-section"));
    const benefitsIndex = sections.findIndex(({ props }) => props.className?.includes("shop-benefits-section"));

    expect(orderedChildren[2] && isValidElement(orderedChildren[2]) ? orderedChildren[2].type : null).toBe(ShopEditorialSections);
    expect(spottedIndex).toBe(0);
    expect(benefitsIndex).toBe(spottedIndex + 1);

    const spotted = sections[spottedIndex];
    const spottedText = collectText(spotted).join(" ").replace(/\s+/g, " ");
    const imageSources = findElements(spotted, Image).map((image) => (image as ReactElement<{ src: string }>).props.src);

    expect(spottedText).toContain("Snack spotted");
    expect(spottedText).toContain("From desk to mat to couch, Beej goes where you go.");
    expect(spottedText).toContain("Every snack starts with a seed.");
    expect(imageSources).toEqual([
      "/assets/pudina-hands.jpg",
      "/assets/himalayan-hand.jpg",
      "/assets/cheese-table.jpg",
      "/assets/sprout-single.jpg",
    ]);
    expect(collectText(sections[benefitsIndex]).join(" ")).toContain("On every order above ₹499.");
    expect(collectText(sections[benefitsIndex]).join(" ")).toContain("Packed for crunch, resealable to keep it.");
    expect(collectText(sections[benefitsIndex]).join(" ")).toContain("From Surat, Gujarat, to your door.");
  });

  it("builds the Our Story page in the approved editorial sequence", async () => {
    const page = await AboutPage();
    const children = childrenOf(page);
    const text = collectText(children).join(" ").replace(/\s+/g, " ");
    const classes = collectClasses(children);
    const sections = findElements(children, "section") as Array<ReactElement<{ className?: string }>>;
    const imageSources = findElements(children, Image).map((image) => (image as ReactElement<{ src: string }>).props.src);
    const hero = sections[0];
    const values = sections.find(({ props }) => props.className?.includes("artifact-about-beliefs"));

    expect(text).toContain("Rooted in nature. Growing with purpose.");
    expect(text).toContain("A seed may be tiny, but it carries the promise of growth.");
    expect(text).toContain("“Beej” means seed.");
    expect(text).toContain("the smallest choices shape the biggest transformations, including what you reach for when the 4pm hunger hits.");
    expect(text).toContain("Our journey begins with a purpose that goes far beyond the snack bag.");
    expect(text).toContain("What we believe");
    expect(text).toContain("Humble ingredients");
    expect(text).toContain("Mindful habits");
    expect(text).toContain("Joy in every bite");
    expect(text).toContain("Plant a better snack habit");
    expect(text).toContain("Shop the range");
    expect(sections).toHaveLength(5);
    expect(sections.map(({ props }) => props.className)).toEqual([
      "about-hero artifact-about-hero",
      "artifact-about-intro",
      "artifact-about-seed-banner",
      "beliefs-section artifact-about-beliefs",
      "artifact-about-cta",
    ]);
    expect(imageSources).toEqual([
      "/assets/seedlings.jpg",
      "/assets/makhana-pond.jpg",
      "/assets/himalayan-yoga.jpg",
      "/assets/pudina-pop.jpg",
      "/assets/sprout-single.jpg",
      "/assets/squad-lifter-hq.png",
      "/assets/squad-skater-hq.png",
    ]);
    expect(hero && collectLinks(hero)).toHaveLength(0);
    expect(values && collectText(values).join(" ")).toContain("Nature already did the hard work. We keep labels short and honest.");
    expect(text).not.toMatch(/Meet the Beej squad|A story that starts small|Small beginnings can grow into big things/);
    expect(classes.some((value) => value.split(/\s+/).includes("artifact-about-hero"))).toBe(true);
  });
});
