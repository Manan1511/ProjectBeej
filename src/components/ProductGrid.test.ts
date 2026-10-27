import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BeejProduct } from "@/lib/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/cart-coordinator", () => ({
  cartCoordinator: { adjustQuantity: vi.fn(), getSnapshot: vi.fn(() => ({ message: "" })) },
  describeProductVariant: vi.fn(() => ({})),
  useCartSnapshot: vi.fn(),
}));

import { ProductGrid } from "./ProductGrid";
import { useCartSnapshot } from "@/components/cart-coordinator";

const product: BeejProduct = {
  id: "gid://shopify/Product/1",
  handle: "peri-peri",
  title: "Peri Peri",
  description: "Description that is not shown in the reference cards.",
  productType: "Roasted Makhana",
  images: [
    { url: "/assets/peri-drop.jpg", alt: "Peri Peri jar" },
    { url: "/assets/peri-flatlay.jpg", alt: "Peri Peri snack flat lay" },
  ],
  variants: [{ id: "gid://shopify/ProductVariant/1", title: "Jar", availableForSale: true, price: { amount: "299", currencyCode: "INR" }, selectedOptions: [] }],
  price: { amount: "299", currencyCode: "INR" },
  availableForSale: true,
  collectionHandles: [],
  metafields: {},
  preview: false,
};

describe("product grid presentation", () => {
  beforeEach(() => {
    vi.mocked(useCartSnapshot).mockReturnValue({ cart: null, confirmedCart: null, loaded: true, loading: false, pending: false, message: "" });
  });

  it("uses the reference image-led card treatment without the mascot overlay", () => {
    const featuredProduct = { ...product, images: [product.images[0], { url: "/assets/home-hover.jpg", alt: "Alternate Peri Peri scene" }] };
    const markup = renderToStaticMarkup(createElement(ProductGrid, { products: [featuredProduct], listName: "Home featured" }));

    expect(markup).toContain("home-product-card");
    expect(markup).toContain('data-hover-image-src="/assets/home-hover.jpg"');
    expect(markup).toContain("Bestseller");
    expect(markup).toContain("Roasted Makhana");
    expect(markup).toContain("₹299");
    expect(markup).toContain("Jar");
    expect(markup).toContain(">ADD</button>");
    expect(markup).not.toContain("Adding");
    expect(markup).not.toContain("The Lifter");
    expect(markup).not.toContain("Description that is not shown");
  });

  it("keeps preview products visually close to the reference without implying checkout is active", () => {
    const previewProduct = { ...product, preview: true, availableForSale: false, variants: [{ ...product.variants[0], availableForSale: false }] };
    const markup = renderToStaticMarkup(createElement(ProductGrid, { products: [previewProduct], listName: "Home featured" }));

    expect(markup).toContain(">ADD</button>");
    expect(markup).toMatch(/<button[^>]*aria-label="Add Peri Peri once products are published"[^>]*disabled/);
    expect(markup).not.toContain("Preview</span>");
    expect(markup).not.toContain("₹299draft");
    expect(markup).not.toContain("Setup preview");
  });

  it("uses clean editorial shop cards and swaps each product to its second image", () => {
    const previewProduct = { ...product, preview: true, availableForSale: false, variants: [{ ...product.variants[0], availableForSale: false }] };
    const markup = renderToStaticMarkup(createElement(ProductGrid, {
      products: [previewProduct],
      filters: true,
      listName: "Shop all",
      presentation: "shop",
      toolbar: createElement("input", { id: "shop-search", type: "search" }),
    }));

    expect(markup).toContain("artifact-shop-grid");
    expect(markup).toContain("All 1");
    expect(markup).toContain("Roasted Makhana 1");
    expect(markup).toContain("Ready to Roast 0");
    expect(markup.indexOf('id="shop-search"')).toBeLessThan(markup.indexOf('aria-label="Open filters and sorting"'));
    expect(markup).toContain('class="product-filter-control"');
    expect(markup).toContain('aria-controls="product-filter-menu"');
    expect(markup).toContain('id="product-filter-menu"');
    expect(markup).toContain('aria-label="Product categories"');
    expect(markup).toContain('aria-label="Sort products"');
    expect(markup).toContain('aria-label="Roasted Makhana 1"');
    expect(markup).toContain(">Featured</button>");
    expect(markup).toContain(">Price: low to high</button>");
    expect(markup).not.toContain('class="filter-pills"');
    expect(markup).not.toContain('class="sort-control"');
    expect(markup).not.toContain("product-hover-photo");
    expect(markup).toContain('data-hover-image-src="/assets/peri-flatlay.jpg"');
    expect(markup).toContain("Bestseller");
    expect(markup).toContain("₹299");
    expect(markup).toContain("Jar");
    expect(markup).toMatch(/<button[^>]*aria-label="Add Peri Peri once products are published"[^>]*disabled/);
    expect(markup).not.toContain("product-mascot");
    expect(markup).not.toContain("The Lifter");
    expect(markup).not.toContain("Description that is not shown");
    expect(markup).not.toContain("Preview</span>");
  });

  it("uses the matching local alternate when a product has only one Shopify image", () => {
    const singleImageProduct = { ...product, handle: "pudina", title: "Pudina", images: [product.images[0]] };
    const markup = renderToStaticMarkup(createElement(ProductGrid, {
      products: [singleImageProduct],
      listName: "Shop all",
      presentation: "shop",
    }));

    expect(markup).not.toContain("product-hover-photo");
    expect(markup).toContain('data-hover-image-src="/assets/pudina-pop.jpg"');
  });

  it("puts collection category and sort choices inside the same filter icon", () => {
    const markup = renderToStaticMarkup(createElement(ProductGrid, { products: [product], filters: true, listName: "Collection" }));

    expect(markup).toContain('aria-label="Open filters and sorting"');
    expect(markup).toContain('id="product-filter-menu"');
    expect(markup).toContain('aria-label="Product categories"');
    expect(markup).toContain('aria-label="Sort products"');
    expect(markup).toContain(">All snacks</button>");
    expect(markup).toContain(">Featured</button>");
    expect(markup).not.toContain('class="filter-pills"');
    expect(markup).not.toContain('class="sort-control"');
  });

  it("keeps expired bag notices out of product shelves", () => {
    vi.mocked(useCartSnapshot).mockReturnValue({ cart: null, confirmedCart: null, loaded: true, loading: false, pending: false, message: "Your previous bag expired. Start a new bag to continue." });

    const markup = renderToStaticMarkup(createElement(ProductGrid, { products: [product], listName: "Home featured" }));

    expect(markup).not.toContain("Your previous bag expired");
  });

  it("keeps other cart operation messages visible in product shelves", () => {
    vi.mocked(useCartSnapshot).mockReturnValue({ cart: null, confirmedCart: null, loaded: true, loading: false, pending: false, message: "Some items could not be added." });

    const markup = renderToStaticMarkup(createElement(ProductGrid, { products: [product], listName: "Home featured" }));

    expect(markup).toContain("Some items could not be added.");
  });
});
