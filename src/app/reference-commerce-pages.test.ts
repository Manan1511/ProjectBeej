import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct, ShopifyCart } from "@/lib/types";

vi.mock("@/lib/storefront", () => ({
  getProduct: vi.fn(),
  getProducts: vi.fn(),
  getShopifyCart: vi.fn(),
  parseApprovedReviews: vi.fn(() => []),
  parseProductFaqs: vi.fn(() => []),
}));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));
vi.mock("@/lib/site-url", () => ({ getPublicSiteUrl: () => null }));
vi.mock("@/lib/cart-cookie", () => ({ readStoredCartId: vi.fn(async () => "gid://shopify/Cart/cart-key?key=private") }));

import ProductPage from "./products/[handle]/page";
import CartPage from "./cart/page";
import { ProductDetail } from "@/components/ProductDetail";
import { CartPanel } from "@/components/CartPanel";
import { getProduct, getProducts, getShopifyCart } from "@/lib/storefront";

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

const cart: ShopifyCart = {
  id: "gid://shopify/Cart/live-id?key=secret",
  checkoutUrl: "https://checkout.shopify.com/secret",
  totalQuantity: 2,
  cost: {
    subtotalAmount: { amount: "834.00", currencyCode: "INR" },
    totalAmount: { amount: "834.00", currencyCode: "INR" },
  },
  lines: [{
    id: "line-1",
    quantity: 2,
    merchandise: {
      id: "gid://shopify/ProductVariant/801234567",
      title: "30 g pouch",
      availableForSale: true,
      price: { amount: "417.00", currencyCode: "INR" },
      selectedOptions: [{ name: "Size", value: "30 g pouch" }],
      product: {
        id: product.id,
        title: product.title,
        handle: product.handle,
        productType: product.productType,
        featuredImage: product.images[0],
      },
    },
  }],
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

describe("Product and Cart routes keep Shopify as their data source", () => {
  beforeEach(() => {
    vi.mocked(getProduct).mockResolvedValue(product);
    vi.mocked(getProducts).mockResolvedValue([]);
    vi.mocked(getShopifyCart).mockResolvedValue(cart);
  });

  it("passes a numeric variant query through to the Shopify product detail", async () => {
    const page = await ProductPage({
      params: Promise.resolve({ handle: "pudina" }),
      searchParams: Promise.resolve({ variant: "801234567" }),
    });
    const detail = findElements(childrenOf(page), ProductDetail)[0] as ReactElement<{ product: BeejProduct; initialVariantId?: string }> | undefined;

    expect(detail?.props.product).toEqual(product);
    expect(detail?.props.initialVariantId).toBe("gid://shopify/ProductVariant/801234567");
    expect(classesOf(page).some((value) => value.split(/\s+/).includes("artifact-product-page"))).toBe(true);
  });

  it("passes the public Shopify cart through without sample prices or shipping thresholds", async () => {
    const page = await CartPage();
    const panel = findElements(childrenOf(page), CartPanel)[0] as ReactElement<{ initialCart: ShopifyCart | null; shippingConfigured: boolean }> | undefined;
    const expectedCart = { ...cart, id: "gid://shopify/Cart/live-id", checkoutUrl: "" };

    expect(panel?.props.initialCart).toEqual(expectedCart);
    expect(typeof panel?.props.shippingConfigured).toBe("boolean");
    expect(panel?.props.initialCart?.cost.subtotalAmount.amount).toBe("834.00");
    expect(JSON.stringify(panel?.props.initialCart)).not.toMatch(/299|149|499/);
    expect(classesOf(page).some((value) => value.split(/\s+/).includes("artifact-cart-page"))).toBe(true);
  });
});
