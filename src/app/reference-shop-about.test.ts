import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storefront", () => ({ getProducts: vi.fn(), getShopifyPage: vi.fn(), getShopifyCart: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));
vi.mock("@/lib/cart-cookie", () => ({ readStoredCartId: vi.fn(async () => "cart-id") }));

import ShopPage from "./shop/page";
import AboutPage from "./about/page";
import { ProductGrid } from "@/components/ProductGrid";
import { StoreSearchForm } from "@/components/StoreSearchForm";
import { MobileNav } from "@/components/MobileNav";
import { SiteHeader } from "@/components/SiteHeader";
import { getProducts, getShopifyCart, getShopifyPage } from "@/lib/storefront";

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
    vi.mocked(getProducts).mockResolvedValue([]);
    vi.mocked(getShopifyPage).mockResolvedValue(null);
    vi.mocked(getShopifyCart).mockResolvedValue({ totalQuantity: 3 } as never);
  });

  it("keeps the shared desktop header routes and displays the live bag count", async () => {
    const header = await SiteHeader({ settings: {} });
    const links = collectLinks(header);
    const hrefs = links.map(({ href }) => href);

    expect(hrefs).toEqual(expect.arrayContaining(["/", "/shop", "/about", "/cart"]));
    expect(links.find(({ href }) => href === "/cart")?.label).toContain("3");
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

  it("keeps Shop search, category filters, and sorting inside the catalog route", async () => {
    const page = await ShopPage({ searchParams: Promise.resolve({}) });
    const children = childrenOf(page);
    const text = collectText(children).join(" ").replace(/\s+/g, " ");
    const headings = findElements(children, "h1");
    const grids = findElements(children, ProductGrid);

    expect(headings).toHaveLength(1);
    expect(collectText(childrenOf(headings[0])).join("")).toBe("Shop all");
    expect(text).toContain("Find your flavour.");
    expect(findElements(children, StoreSearchForm)).toHaveLength(1);
    expect((grids[0] as ReactElement<{ filters?: boolean }> | undefined)?.props.filters).toBe(true);
    expect(collectClasses(children).some((value) => value.split(/\s+/).includes("artifact-shop-hero"))).toBe(true);
  });

  it("uses the artifact About hierarchy without unsupported product or origin claims", async () => {
    const page = await AboutPage();
    const children = childrenOf(page);
    const text = collectText(children).join(" ").replace(/\s+/g, " ");
    const classes = collectClasses(children);

    expect(text).toContain("Rooted in nature. Growing with purpose.");
    expect(text).toContain("Small beginnings can grow into big things.");
    expect(classes.some((value) => value.split(/\s+/).includes("artifact-about-hero"))).toBe(true);
    expect(text).not.toMatch(/\b(healthy|healthier|gluten[ -]?free|protein|fibre|fiber|jain-friendly|taxes included|made in india|grown in india|free shipping|natural ingredients?|humblest ingredients?)\b/i);
  });
});
