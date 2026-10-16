"use client";

const pendingCartWrites = new Map<string, Promise<unknown>>();
let browserCartKey: string | undefined;

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

export function serializeCartWrite<T>(operation: () => Promise<T>, queueKey = "bag"): Promise<T> {
  const previous = pendingCartWrites.get(queueKey) ?? Promise.resolve();
  const queuedAt = performance.now();
  const safeName = /^[a-z0-9-]+$/i.test(queueKey) ? queueKey : "unknown";
  const execute = async () => {
    const startedAt = performance.now();
    performance.measure(`beej:cart:${safeName}:queue`, { start: queuedAt, end: startedAt });
    try {
      return await operation();
    } finally {
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
