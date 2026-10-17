"use client";

const pendingCartWrites = new Map<string, Promise<unknown>>();
let browserCartKey: string | undefined;
let browserTabId: string | undefined;

export function getBrowserCartKey(): string {
  if (browserCartKey) return browserCartKey;
  try {
    const saved = window.localStorage.getItem("beej-cart-session");
    if (saved && saved.length >= 8 && saved.length <= 100) browserCartKey = saved;
    else {
      browserCartKey = window.crypto.randomUUID();
      window.localStorage.setItem("beej-cart-session", browserCartKey);
    }
  } catch {
    browserCartKey = window.crypto.randomUUID();
  }
  return browserCartKey;
}

export function getBrowserCartTabId(): string {
  browserTabId ||= globalThis.crypto.randomUUID();
  return browserTabId;
}

export function serializeCartWrite<T>(operation: () => Promise<T>, queueKey = "bag"): Promise<T> {
  const previous = pendingCartWrites.get(queueKey) ?? Promise.resolve();
  const queuedAt = performance.now();
  const safeName = /^[a-z0-9-]+$/i.test(queueKey) ? queueKey : "unknown";
  const execute = async () => {
    const startedAt = performance.now();
    performance.clearMeasures(`beej:cart:${safeName}:queue`);
    performance.measure(`beej:cart:${safeName}:queue`, { start: queuedAt, end: startedAt });
    try {
      return await operation();
    } finally {
      performance.clearMeasures(`beej:cart:${safeName}:request`);
      performance.measure(`beej:cart:${safeName}:request`, { start: startedAt, end: performance.now() });
    }
  };
  const next = previous.then(execute, execute);
  const queued = next.catch(() => undefined);
  pendingCartWrites.set(queueKey, queued);
  void queued.then(() => {
    if (pendingCartWrites.get(queueKey) === queued) pendingCartWrites.delete(queueKey);
  });
  return next;
}

/** Serializes writes in this tab and coordinates them with other tabs when Web Locks are available. */
export function withBrowserCartLock<T>(operation: () => Promise<T>): Promise<T> {
  return serializeCartWrite(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request("project-beej-cart", operation);
    }
    return await operation();
  }, "bag");
}
