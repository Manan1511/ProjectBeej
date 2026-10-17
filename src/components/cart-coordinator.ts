"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MAX_CART_QUANTITY, MAX_LINE_QUANTITY } from "@/lib/commerce";
import type { CartQuantityChange } from "@/lib/cart-actions";
import type { BeejProduct, CartLine, ProductVariant, ShopifyCart } from "@/lib/types";
import { createCommerceItem, createShopifyAnalyticsProduct, emitCommerceEvent } from "@/lib/tracking-client";
import { getBrowserCartKey, getBrowserCartTabId, withBrowserCartLock } from "@/components/cart-request";

export type CartItemDescriptor = {
  variantId: string;
  variantTitle: string;
  price: { amount: string; currencyCode: string };
  product: CartLine["merchandise"]["product"];
};

export function describeProductVariant(product: BeejProduct, variant: ProductVariant): CartItemDescriptor {
  return {
    variantId: variant.id,
    variantTitle: variant.title,
    price: variant.price,
    product: {
      id: product.id,
      title: product.title,
      handle: product.handle,
      productType: product.productType,
      featuredImage: product.images[0] || null,
    },
  };
}

export type CartCoordinatorRead = { cart: ShopifyCart | null; expired?: boolean };
export type CartCoordinatorWrite = {
  cart: ShopifyCart | null;
  warnings: Array<{ message: string }>;
  changes: CartQuantityChange[];
  recovered?: boolean;
};
export type CartCoordinatorTransport = {
  readCart(): Promise<CartCoordinatorRead>;
  writeTargets(targets: Array<{ variantId: string; quantity: number; baseQuantity: number }>): Promise<CartCoordinatorWrite>;
};

export type CartCoordinatorSnapshot = {
  cart: ShopifyCart | null;
  confirmedCart: ShopifyCart | null;
  loaded: boolean;
  loading: boolean;
  pending: boolean;
  message: string;
};

type Intent = { delta: number; revision: number };
type InFlight = Map<string, Intent>;
type CartCoordinator = ReturnType<typeof createCartCoordinator>;

const emptyCart: ShopifyCart = {
  id: "",
  checkoutUrl: "",
  totalQuantity: 0,
  cost: { subtotalAmount: { amount: "0", currencyCode: "INR" }, totalAmount: { amount: "0", currencyCode: "INR" } },
  lines: [],
};
const emptyServerSnapshot: CartCoordinatorSnapshot = { cart: null, confirmedCart: null, loaded: false, loading: false, pending: false, message: "" };

function variantQuantity(cart: ShopifyCart | null, variantId: string): number {
  return cart?.lines.reduce((sum, line) => sum + (line.merchandise.id === variantId ? line.quantity : 0), 0) || 0;
}

function descriptorFromLine(line: CartLine): CartItemDescriptor {
  return { variantId: line.merchandise.id, variantTitle: line.merchandise.title, price: line.merchandise.price, product: line.merchandise.product };
}

function lineFromDescriptor(descriptor: CartItemDescriptor, quantity: number): CartLine {
  return {
    id: `pending:${descriptor.variantId}`,
    quantity,
    merchandise: {
      id: descriptor.variantId,
      title: descriptor.variantTitle,
      availableForSale: true,
      price: descriptor.price,
      selectedOptions: [],
      product: descriptor.product,
    },
  };
}

function makeProjectedCart(confirmed: ShopifyCart | null, deltas: Map<string, Intent>, descriptors: Map<string, CartItemDescriptor>): ShopifyCart | null {
  const cart = confirmed || emptyCart;
  const touched = new Set([...deltas.keys()]);
  const lines = cart.lines.filter((line) => !touched.has(line.merchandise.id));
  for (const [variantId, intent] of deltas) {
    const quantity = Math.max(0, variantQuantity(confirmed, variantId) + intent.delta);
    if (quantity === 0) continue;
    const existing = confirmed?.lines.find((line) => line.merchandise.id === variantId);
    const descriptor = descriptors.get(variantId) || (existing && descriptorFromLine(existing));
    if (descriptor) lines.push(existing ? { ...existing, quantity } : lineFromDescriptor(descriptor, quantity));
  }
  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  if (!confirmed && totalQuantity === 0) return null;
  return { ...cart, lines, totalQuantity };
}

function emitAcceptedChanges(changes: CartQuantityChange[], cart: ShopifyCart | null, descriptors: Map<string, CartItemDescriptor>) {
  for (const change of changes) {
    const descriptor = descriptors.get(change.variantId);
    const accepted = change.acceptedQuantity || change.removedQuantity;
    if (!descriptor || accepted <= 0) continue;
    const added = change.acceptedQuantity > 0;
    const item = createCommerceItem({
      variantId: descriptor.variantId,
      title: descriptor.product.title,
      price: descriptor.price.amount,
      quantity: accepted,
      brand: "Project Beej",
      category: descriptor.product.productType,
      variant: descriptor.variantTitle,
    });
    if (!item) continue;
    const shopifyProduct = createShopifyAnalyticsProduct({
      productGid: descriptor.product.id,
      variantGid: descriptor.variantId,
      name: descriptor.product.title,
      variantName: descriptor.variantTitle,
      brand: "Project Beej",
      category: descriptor.product.productType,
      price: descriptor.price.amount,
      quantity: accepted,
    });
    emitCommerceEvent({
      name: added ? "add_to_cart" : "remove_from_cart",
      currency: descriptor.price.currencyCode,
      value: Number(descriptor.price.amount) * accepted,
      items: [item],
    }, added ? { shopifyCartId: cart?.id, ...(shopifyProduct ? { shopifyProducts: [shopifyProduct] } : {}) } : {});
  }
}

export function createCartCoordinator(transport: CartCoordinatorTransport, batchDelayMs = 100) {
  const listeners = new Set<() => void>();
  const intents = new Map<string, Intent>();
  const descriptors = new Map<string, CartItemDescriptor>();
  let confirmed: ShopifyCart | null = null;
  let loaded = false;
  let loading = false;
  let loadingPromise: Promise<void> | null = null;
  let inFlight: InFlight | null = null;
  let flushPromise: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let revision = 0;
  let message = "";
  let snapshot: CartCoordinatorSnapshot = { cart: null, confirmedCart: null, loaded: false, loading: false, pending: false, message: "" };

  function notify() {
    snapshot = {
      cart: makeProjectedCart(confirmed, intents, descriptors),
      confirmedCart: confirmed,
      loaded,
      loading,
      pending: intents.size > 0 || inFlight !== null,
      message,
    };
    for (const listener of listeners) listener();
  }

  function getQuantity(variantId: string): number {
    return Math.max(0, variantQuantity(confirmed, variantId) + (intents.get(variantId)?.delta || 0));
  }

  function applyCart(cart: ShopifyCart | null) {
    confirmed = cart;
    for (const line of cart?.lines || []) descriptors.set(line.merchandise.id, descriptorFromLine(line));
  }

  async function load(force = false): Promise<void> {
    if (loadingPromise) return loadingPromise;
    if (loaded && !force) return;
    loading = true;
    notify();
    const currentRevision = revision;
    loadingPromise = transport.readCart().then((result) => {
      applyCart(result.cart);
      loaded = true;
      if (result.expired) message = "Your previous bag expired. Start a new bag to continue.";
      else if (currentRevision === revision && !intents.size) message = "";
      notify();
    }).catch((error: unknown) => {
      message = error instanceof Error ? error.message : "Your bag could not be loaded. Try again.";
      notify();
      throw error;
    }).finally(() => {
      loading = false;
      loadingPromise = null;
      notify();
    });
    return loadingPromise;
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush().catch(() => undefined);
    }, batchDelayMs);
  }

  function hasNonZeroIntent() {
    return [...intents.values()].some((intent) => intent.delta !== 0);
  }

  async function flush(): Promise<void> {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (flushPromise) return flushPromise;
    flushPromise = (async () => {
      await load();
      let recoveredAfterFailure = false;
      while (hasNonZeroIntent()) {
        const batch: InFlight = new Map([...intents].filter(([, intent]) => intent.delta !== 0));
        inFlight = batch;
        message = "";
        notify();
        const targets = [...batch].map(([variantId, intent]) => {
          const baseQuantity = variantQuantity(confirmed, variantId);
          return { variantId, baseQuantity, quantity: Math.max(0, Math.min(MAX_LINE_QUANTITY, baseQuantity + intent.delta)) };
        });
        try {
          const result = await transport.writeTargets(targets);
          applyCart(result.cart);
          for (const [variantId, submitted] of batch) {
            const current = intents.get(variantId);
            if (!current) continue;
            if (current.revision === submitted.revision) intents.delete(variantId);
            else {
              const remainingDelta = current.delta - submitted.delta;
              if (remainingDelta === 0) intents.delete(variantId);
              else intents.set(variantId, { delta: remainingDelta, revision: current.revision });
            }
          }
          emitAcceptedChanges(result.changes, result.cart, descriptors);
          if (result.recovered) message = result.cart
            ? "Your previous bag expired. Your latest changes were applied to a new bag."
            : "Your previous bag expired. Add your items again to continue.";
          else if (result.warnings.length) message = result.warnings.map((warning) => warning.message).join(" ");
          notify();
          recoveredAfterFailure = false;
        } catch (error) {
          let reconciledCart = confirmed;
          let reconciled = false;
          let reconciledExpired = false;
          try {
            const result = await transport.readCart();
            reconciledCart = result.cart;
            reconciled = true;
            applyCart(reconciledCart);
            reconciledExpired = Boolean(result.expired);
          } catch {
            // Keep the last known server cart if reconciliation is also unavailable.
          }
          const canRetryAfterReconciliation = !recoveredAfterFailure;
          let targetMismatchAfterFinalAttempt = false;
          if (reconciled) {
            const submittedTargets = new Map(targets.map((target) => [target.variantId, target]));
            for (const [variantId, submitted] of batch) {
              const current = intents.get(variantId);
              const target = submittedTargets.get(variantId);
              if (!current || !target) continue;
              const laterClicks = current.delta - submitted.delta;
              const requestedQuantity = Math.max(0, Math.min(MAX_LINE_QUANTITY, target.quantity + laterClicks));
              const remainingDelta = requestedQuantity - variantQuantity(reconciledCart, variantId);
              if (remainingDelta === 0) intents.delete(variantId);
              else if (canRetryAfterReconciliation) intents.set(variantId, { delta: remainingDelta, revision: current.revision });
              else {
                intents.delete(variantId);
                targetMismatchAfterFinalAttempt = true;
              }
            }
          } else {
            // The write may have reached Shopify. Without a readable cart, keep the last
            // confirmed quantities and wait for a later user action instead of retrying.
            intents.clear();
          }
          const failure = error instanceof Error ? error : new Error("Your bag could not be updated.");
          for (const [variantId, intent] of intents) if (intent.delta === 0) intents.delete(variantId);
          if (reconciled && !hasNonZeroIntent() && !targetMismatchAfterFinalAttempt) {
            message = reconciledExpired ? "Your previous bag expired. Start a new bag to continue." : "";
            notify();
            return;
          }
          if (reconciled && hasNonZeroIntent() && canRetryAfterReconciliation) {
            recoveredAfterFailure = true;
            notify();
            continue;
          }
          message = failure.message;
          notify();
          throw failure;
        } finally {
          inFlight = null;
          notify();
        }
      }
      for (const [variantId, intent] of intents) if (intent.delta === 0) intents.delete(variantId);
      notify();
    })().finally(() => { flushPromise = null; });
    return flushPromise;
  }

  function adjustQuantity(variantId: string, delta: number, descriptor?: CartItemDescriptor): boolean {
    if (!variantId || !Number.isSafeInteger(delta) || delta === 0) return false;
    if (descriptor) descriptors.set(variantId, descriptor);
    const before = getQuantity(variantId);
    const target = Math.max(0, Math.min(MAX_LINE_QUANTITY, before + delta));
    if (target === before) return false;
    const total = snapshot.cart?.totalQuantity || 0;
    if (target > before && total + target - before > MAX_CART_QUANTITY) {
      message = `Your bag can hold up to ${MAX_CART_QUANTITY} items.`;
      notify();
      return false;
    }
    revision += 1;
    const nextDelta = target - variantQuantity(confirmed, variantId);
    if (nextDelta === 0 && !inFlight?.has(variantId)) intents.delete(variantId);
    else intents.set(variantId, { delta: nextDelta, revision });
    message = "";
    notify();
    if (intents.size) schedule();
    else if (timer) { clearTimeout(timer); timer = null; }
    return true;
  }

  function setQuantity(variantId: string, target: number, descriptor?: CartItemDescriptor): boolean {
    if (!Number.isSafeInteger(target) || target < 0 || target > MAX_LINE_QUANTITY) return false;
    return adjustQuantity(variantId, target - getQuantity(variantId), descriptor);
  }

  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot() { return snapshot; },
    getServerSnapshot() { return emptyServerSnapshot; },
    load,
    refresh() { return load(true); },
    flush,
    adjustQuantity,
    setQuantity,
    getQuantity,
  };
}

async function readBrowserCart(): Promise<CartCoordinatorRead> {
  const response = await fetch("/api/cart", { cache: "no-store" });
  const data = await response.json() as { cart?: ShopifyCart | null; expired?: boolean; error?: string };
  if (!response.ok) throw new Error(data.error || "Your bag could not be loaded.");
  return { cart: data.cart || null, expired: data.expired };
}

async function writeBrowserCartTargets(targets: Array<{ variantId: string; quantity: number; baseQuantity: number }>): Promise<CartCoordinatorWrite> {
  return withBrowserCartLock(async () => {
    const response = await fetch("/api/cart/lines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets, clientKey: getBrowserCartKey() }),
    });
    const data = await response.json() as CartCoordinatorWrite & { error?: string };
    if (!response.ok) throw new Error(data.error || "Your bag could not be updated.");
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel("beej-cart");
      channel.postMessage({ type: "cart-updated", source: getBrowserCartTabId() });
      channel.close();
    }
    return { cart: data.cart || null, warnings: data.warnings || [], changes: data.changes || [], recovered: data.recovered };
  });
}

export const cartCoordinator: CartCoordinator = createCartCoordinator({ readCart: readBrowserCart, writeTargets: writeBrowserCartTargets });

if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
  const channel = new BroadcastChannel("beej-cart");
  channel.addEventListener("message", (event: MessageEvent<{ type?: string; source?: string }>) => {
    if (event.data?.type === "cart-updated" && event.data.source !== getBrowserCartTabId()) void cartCoordinator.refresh().catch(() => undefined);
  });
}

export function useCartSnapshot(): CartCoordinatorSnapshot {
  const snapshot = useSyncExternalStore(cartCoordinator.subscribe, cartCoordinator.getSnapshot, cartCoordinator.getServerSnapshot);
  useEffect(() => { void cartCoordinator.load().catch(() => undefined); }, []);
  return snapshot;
}

export function useCartQuantity(variantId: string, descriptor?: CartItemDescriptor): number {
  const snapshot = useCartSnapshot();
  useEffect(() => { if (descriptor) cartCoordinator.setQuantity(variantId, cartCoordinator.getQuantity(variantId), descriptor); }, [descriptor, variantId]);
  return snapshot.cart?.lines.find((line) => line.merchandise.id === variantId)?.quantity || 0;
}
