import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";

vi.mock("@/lib/storefront", () => ({ getProducts: vi.fn(), getSiteSettings: vi.fn() }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));

import HomePage from "./page";
import { ProductGrid } from "@/components/ProductGrid";
import { getProducts, getSiteSettings } from "@/lib/storefront";

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

describe("homepage featured product ordering", () => {
  beforeEach(() => {
    vi.mocked(getProducts).mockResolvedValue([
      product("unlisted-1"),
      product("unlisted-2"),
      product("unlisted-3"),
      product("unlisted-4"),
      product("unlisted-5"),
      product("unlisted-6"),
      product("featured-b"),
      product("featured-a"),
    ]);
    vi.mocked(getSiteSettings).mockResolvedValue({ featuredHandles: ["featured-a", "featured-b"] });
  });

  it("keeps configured products ahead of unlisted products before applying the five-item limit", async () => {
    const page = await HomePage();
    const grid = findProductGrid(page);

    expect(grid?.props.products.map(({ handle }) => handle)).toEqual([
      "featured-a",
      "featured-b",
      "unlisted-1",
      "unlisted-2",
      "unlisted-3",
    ]);
  });
});
