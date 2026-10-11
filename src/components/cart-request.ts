"use client";

let pendingCartWrite: Promise<unknown> = Promise.resolve();
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

export function serializeCartWrite<T>(operation: () => Promise<T>): Promise<T> {
  const next = pendingCartWrite.then(operation, operation);
  pendingCartWrite = next.catch(() => undefined);
  return next;
}
