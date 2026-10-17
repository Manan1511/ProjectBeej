import { afterEach, describe, expect, it, vi } from "vitest";
import { createCartCoordinator, type CartCoordinatorTransport } from "./cart-coordinator";
import type { ShopifyCart } from "@/lib/types";

const variantId = "gid://shopify/ProductVariant/123";
const secondVariantId = "gid://shopify/ProductVariant/456";
const descriptor = {
  variantId,
  variantTitle: "Default Title",
  price: { amount: "100", currencyCode: "INR" },
  product: { id: "gid://shopify/Product/1", title: "Pudina", handle: "pudina", productType: "Roasted Makhana", featuredImage: { url: "/pudina.jpg", alt: "Pudina" } },
};

function cart(lines: Array<{ variantId: string; quantity: number }>): ShopifyCart | null {
  if (!lines.length) return null;
  const items = lines.map((line, index) => ({
    id: `line-${index + 1}`,
    quantity: line.quantity,
    merchandise: {
      id: line.variantId,
      title: "Default Title",
      availableForSale: true,
      price: { amount: "100", currencyCode: "INR" },
      selectedOptions: [],
      product: { id: `product-${index + 1}`, title: `Product ${index + 1}`, handle: `product-${index + 1}`, productType: "Roasted Makhana" },
    },
  }));
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  return { id: "gid://shopify/Cart/test", checkoutUrl: "", totalQuantity, cost: { subtotalAmount: { amount: String(totalQuantity * 100), currencyCode: "INR" }, totalAmount: { amount: String(totalQuantity * 100), currencyCode: "INR" } }, lines: items };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeTransport(overrides: Partial<CartCoordinatorTransport> = {}) {
  const transport: CartCoordinatorTransport = {
    readCart: vi.fn(async () => ({ cart: null })),
    writeTargets: vi.fn(async () => ({ cart: null, warnings: [], changes: [] })),
    ...overrides,
  };
  return transport;
}

describe("shared cart coordinator", () => {
  afterEach(() => vi.useRealTimers());

  it("shows every rapid quantity click immediately and batches them into one target write", async () => {
    vi.useFakeTimers();
    const write = deferred<Awaited<ReturnType<CartCoordinatorTransport["writeTargets"]>>>();
    const transport = makeTransport({ writeTargets: vi.fn(() => write.promise) });
    const coordinator = createCartCoordinator(transport);
    await coordinator.load();

    coordinator.adjustQuantity(variantId, 1, descriptor);
    coordinator.adjustQuantity(variantId, 1, descriptor);
    coordinator.adjustQuantity(variantId, -1, descriptor);

    expect(coordinator.getQuantity(variantId)).toBe(1);
    expect(coordinator.getSnapshot().pending).toBe(true);
    await vi.advanceTimersByTimeAsync(100);
    expect(transport.writeTargets).toHaveBeenCalledTimes(1);
    expect(transport.writeTargets).toHaveBeenCalledWith([{ variantId, baseQuantity: 0, quantity: 1 }]);

    write.resolve({ cart: cart([{ variantId, quantity: 1 }]), warnings: [], changes: [] });
    await coordinator.flush();
    expect(coordinator.getQuantity(variantId)).toBe(1);
  });

  it("turns a decrement during the first in-flight add into a follow-up removal", async () => {
    vi.useFakeTimers();
    const first = deferred<Awaited<ReturnType<CartCoordinatorTransport["writeTargets"]>>>();
    const second = deferred<Awaited<ReturnType<CartCoordinatorTransport["writeTargets"]>>>();
    const writeTargets = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const coordinator = createCartCoordinator(makeTransport({ writeTargets }));
    await coordinator.load();

    coordinator.adjustQuantity(variantId, 1, descriptor);
    await vi.advanceTimersByTimeAsync(100);
    expect(writeTargets).toHaveBeenCalledTimes(1);
    coordinator.adjustQuantity(variantId, -1, descriptor);
    expect(coordinator.getQuantity(variantId)).toBe(0);

    first.resolve({ cart: cart([{ variantId, quantity: 1 }]), warnings: [], changes: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(writeTargets).toHaveBeenCalledTimes(2);
    expect(writeTargets).toHaveBeenLastCalledWith([{ variantId, baseQuantity: 1, quantity: 0 }]);
    second.resolve({ cart: null, warnings: [], changes: [] });
    await coordinator.flush();
    expect(coordinator.getQuantity(variantId)).toBe(0);
  });

  it("rebases clicks made while the initial cart read is pending", async () => {
    const initialRead = deferred<{ cart: ShopifyCart | null; expired?: boolean }>();
    const coordinator = createCartCoordinator(makeTransport({ readCart: vi.fn(() => initialRead.promise) }));
    const loading = coordinator.load();
    coordinator.adjustQuantity(variantId, 1, descriptor);
    initialRead.resolve({ cart: cart([{ variantId, quantity: 2 }]) });
    await loading;

    expect(coordinator.getQuantity(variantId)).toBe(3);
  });

  it("sends all changed variants together and applies Shopify's accepted quantities", async () => {
    vi.useFakeTimers();
    const transport = makeTransport({
      readCart: vi.fn(async () => ({ cart: cart([{ variantId, quantity: 1 }, { variantId: secondVariantId, quantity: 1 }]) })),
      writeTargets: vi.fn(async () => ({
        cart: cart([{ variantId, quantity: 2 }, { variantId: secondVariantId, quantity: 1 }]),
        warnings: [{ message: "The second item is out of stock." }],
        changes: [{ variantId, previousQuantity: 1, quantity: 2, acceptedQuantity: 1, removedQuantity: 0 }],
      })),
    });
    const coordinator = createCartCoordinator(transport);
    await coordinator.load();
    coordinator.adjustQuantity(variantId, 1, descriptor);
    coordinator.adjustQuantity(secondVariantId, -1);
    await vi.advanceTimersByTimeAsync(100);
    await coordinator.flush();

    expect(transport.writeTargets).toHaveBeenCalledWith([
      { variantId, baseQuantity: 1, quantity: 2 },
      { variantId: secondVariantId, baseQuantity: 1, quantity: 0 },
    ]);
    expect(coordinator.getQuantity(variantId)).toBe(2);
    expect(coordinator.getQuantity(secondVariantId)).toBe(1);
  });

  it("retains the latest confirmed bag and reports an update error after a failed write", async () => {
    vi.useFakeTimers();
    const transport = makeTransport({
      readCart: vi.fn(async () => ({ cart: cart([{ variantId, quantity: 2 }]) })),
      writeTargets: vi.fn(async () => { throw new Error("Network unavailable."); }),
    });
    const coordinator = createCartCoordinator(transport);
    await coordinator.load();
    coordinator.adjustQuantity(variantId, 1, descriptor);
    await expect(coordinator.flush()).rejects.toThrow("Network unavailable.");

    expect(coordinator.getQuantity(variantId)).toBe(2);
    expect(coordinator.getSnapshot().message).toBe("Network unavailable.");
  });

  it("accepts an ambiguous write after reconciliation confirms Shopify applied it", async () => {
    const readCart = vi.fn()
      .mockResolvedValueOnce({ cart: null })
      .mockResolvedValueOnce({ cart: cart([{ variantId, quantity: 1 }]) });
    const writeTargets = vi.fn(async () => { throw new Error("Connection closed after sending the request."); });
    const coordinator = createCartCoordinator(makeTransport({ readCart, writeTargets }));
    await coordinator.load();

    coordinator.adjustQuantity(variantId, 1, descriptor);
    await coordinator.flush();

    expect(readCart).toHaveBeenCalledTimes(2);
    expect(writeTargets).toHaveBeenCalledTimes(1);
    expect(coordinator.getQuantity(variantId)).toBe(1);
    expect(coordinator.getSnapshot()).toMatchObject({ pending: false, message: "" });
  });

  it("retries an ambiguous absolute target only after reconciliation confirms it did not land", async () => {
    const readCart = vi.fn()
      .mockResolvedValueOnce({ cart: null })
      .mockResolvedValueOnce({ cart: null });
    const writeTargets = vi.fn()
      .mockRejectedValueOnce(new Error("Connection closed before the request reached Shopify."))
      .mockResolvedValueOnce({
        cart: cart([{ variantId, quantity: 1 }]),
        warnings: [],
        changes: [{ variantId, previousQuantity: 0, quantity: 1, acceptedQuantity: 1, removedQuantity: 0 }],
      });
    const coordinator = createCartCoordinator(makeTransport({ readCart, writeTargets }));
    await coordinator.load();

    coordinator.adjustQuantity(variantId, 1, descriptor);
    await coordinator.flush();

    expect(readCart).toHaveBeenCalledTimes(2);
    expect(writeTargets).toHaveBeenCalledTimes(2);
    expect(writeTargets).toHaveBeenNthCalledWith(2, [{ variantId, baseQuantity: 0, quantity: 1 }]);
    expect(coordinator.getQuantity(variantId)).toBe(1);
    expect(coordinator.getSnapshot().pending).toBe(false);
  });

  it("does not retry an ambiguous write when reconciliation also fails", async () => {
    const readCart = vi.fn()
      .mockResolvedValueOnce({ cart: null })
      .mockRejectedValueOnce(new Error("Cart read unavailable."));
    const writeTargets = vi.fn(async () => { throw new Error("Connection closed after sending the request."); });
    const coordinator = createCartCoordinator(makeTransport({ readCart, writeTargets }));
    await coordinator.load();

    coordinator.adjustQuantity(variantId, 1, descriptor);
    await expect(coordinator.flush()).rejects.toThrow("Connection closed after sending the request.");

    expect(readCart).toHaveBeenCalledTimes(2);
    expect(writeTargets).toHaveBeenCalledTimes(1);
    expect(coordinator.getQuantity(variantId)).toBe(0);
    expect(coordinator.getSnapshot()).toMatchObject({ pending: false, message: "Connection closed after sending the request." });
  });

  it("surfaces expired-cart recovery after applying the latest requested change", async () => {
    vi.useFakeTimers();
    const transport = makeTransport({
      readCart: vi.fn(async () => ({ cart: cart([{ variantId, quantity: 2 }]) })),
      writeTargets: vi.fn(async () => ({
        cart: cart([{ variantId, quantity: 1 }]), warnings: [], recovered: true,
        changes: [{ variantId, previousQuantity: 0, quantity: 1, acceptedQuantity: 1, removedQuantity: 0 }],
      })),
    });
    const coordinator = createCartCoordinator(transport);
    await coordinator.load();
    coordinator.adjustQuantity(variantId, 1, descriptor);
    await vi.advanceTimersByTimeAsync(100);
    await coordinator.flush();

    expect(coordinator.getQuantity(variantId)).toBe(1);
    expect(coordinator.getSnapshot().message).toContain("previous bag expired");
  });
});
