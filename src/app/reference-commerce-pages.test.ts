import { createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";

vi.mock("@/lib/storefront", () => ({
  getRequestCachedProduct: vi.fn(),
  getCardProducts: vi.fn(),
  parseApprovedReviews: vi.fn(() => []),
  parseProductFaqs: vi.fn(() => []),
}));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));

import ProductPage from "./products/[handle]/page";
import CartPage from "./cart/page";
import { ProductDetail } from "@/components/ProductDetail";
import { CartPanel } from "@/components/CartPanel";
import { getRequestCachedProduct, getCardProducts } from "@/lib/storefront";
import { variantIdFromSearch } from "@/lib/product-variant";

const product: BeejProduct = {
  id: "gid://shopify/Product/121",
  handle: "pudina",
  title: "Pudina",
  description: "A Shopify-managed product description.",
  productType: "Roasted Makhana",
  images: [{ url: "/assets/pudina-pop.jpg", alt: "Pudina snack pack" }],
  variants: [{
    id: "gid://shopify/ProductVariant/801234567",
    title: "30 g pouch",
    availableForSale: true,
    price: { amount: "417.00", currencyCode: "INR" },
    selectedOptions: [{ name: "Size", value: "30 g pouch" }],
  }],
  price: { amount: "417.00", currencyCode: "INR" },
  availableForSale: true,
  collectionHandles: ["roasted-makhana"],
  metafields: {},
  preview: false,
};

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

function classesOf(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(classesOf);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<{ className?: string; children?: ReactNode }>;
  return [element.props.className ?? "", ...classesOf(element.props.children)];
}

function textOf(node: ReactNode): string {
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("Product and Cart routes keep Shopify as their data source", () => {
  beforeEach(() => {
    vi.mocked(getRequestCachedProduct).mockResolvedValue(product);
    vi.mocked(getCardProducts).mockResolvedValue([]);
  });

  it("keeps the product route independent of variant query data while preserving variant URLs", async () => {
    const page = await ProductPage({
      params: Promise.resolve({ handle: "pudina" }),
    });
    const detail = findElements(childrenOf(page), ProductDetail)[0] as ReactElement<{ product: BeejProduct }> | undefined;

    expect(detail?.props.product).toEqual(product);
    expect(variantIdFromSearch(product.variants, "?variant=801234567")).toBe("gid://shopify/ProductVariant/801234567");
    expect(classesOf(page).some((value) => value.split(/\s+/).includes("artifact-product-page"))).toBe(true);
  });

  it("leaves bag data in the private client cart store", async () => {
    const page = await CartPage();
    const panel = findElements(childrenOf(page), CartPanel)[0] as ReactElement<{ shippingConfigured: boolean }> | undefined;

    expect(typeof panel?.props.shippingConfigured).toBe("boolean");
    expect(classesOf(page).some((value) => value.split(/\s+/).includes("artifact-cart-page"))).toBe(true);
    expect(JSON.stringify(panel?.props)).not.toMatch(/secret|834|417/);
  });

  it("shows a loading state instead of briefly presenting an empty bag before the private read", () => {
    const markup = renderToStaticMarkup(createElement(CartPanel, { shippingConfigured: false }));

    expect(markup).toContain("Loading your bag…");
    expect(markup).not.toContain("Your bag is empty");
  });

  it("uses the reference bag heading and three checkout steps", async () => {
    const page = await CartPage();
    const text = textOf(page);
    const title = textOf(findElements(page, "h1")[0]);

    expect(title).toBe("Your bag");
    expect(text).not.toContain("One good choice at a time");
    expect(text).toContain("1 · BAG2 · DETAILS3 · DONE");
  });
});
