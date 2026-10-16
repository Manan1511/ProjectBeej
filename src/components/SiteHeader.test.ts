import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SiteSettings } from "@/lib/types";

vi.mock("@/lib/storefront", () => ({ getShopifyCartCount: vi.fn() }));
vi.mock("@/lib/cart-cookie", () => ({ readStoredCartId: vi.fn(async () => null) }));
vi.mock("@/lib/request-ip", () => ({ requestBuyerIp: vi.fn(async () => null) }));

import { SiteHeader } from "./SiteHeader";
import { getShopifyCartCount } from "@/lib/storefront";
import { readStoredCartId } from "@/lib/cart-cookie";

describe("site navigation", () => {
  it("renders the reference outline bag with its quantity badge", async () => {
    const markup = renderToStaticMarkup(await SiteHeader({ settings: {} as SiteSettings }));

    expect(markup).toContain('class="bag-icon"');
    expect(markup).toContain('aria-label="Bag, 0 items"');
    expect(markup).toContain('class="bag-count">0</span>');
    expect(markup).not.toContain("Bag <span");
  });

  it("loads only the count for an existing bag", async () => {
    vi.mocked(readStoredCartId).mockResolvedValue("gid://shopify/Cart/test?key=private");
    vi.mocked(getShopifyCartCount).mockResolvedValue(3);

    const markup = renderToStaticMarkup(await SiteHeader({ settings: {} as SiteSettings }));

    expect(markup).toContain('aria-label="Bag, 3 items"');
    expect(getShopifyCartCount).toHaveBeenCalledWith("gid://shopify/Cart/test?key=private", null);
  });
});
