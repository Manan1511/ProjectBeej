const queues = new Map<string, Promise<unknown>>();
const clientCartAliases = new Map<string, { cartId: string; expiresAt: number }>();
const CLIENT_CART_ALIAS_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CLIENT_CART_ALIASES = 5000;

/** Process-local fallback for concurrent first writes whose requests were sent before the cart cookie existed. */
export function getClientCartAlias(clientKey?: string): string | null {
  if (!clientKey) return null;
  const entry = clientCartAliases.get(clientKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    clientCartAliases.delete(clientKey);
    return null;
  }
  clientCartAliases.delete(clientKey);
  clientCartAliases.set(clientKey, { ...entry, expiresAt: Date.now() + CLIENT_CART_ALIAS_TTL_MS });
  return entry.cartId;
}

export function setClientCartAlias(clientKey: string | undefined, cartId: string): void {
  if (!clientKey) return;
  clientCartAliases.delete(clientKey);
  clientCartAliases.set(clientKey, { cartId, expiresAt: Date.now() + CLIENT_CART_ALIAS_TTL_MS });
  while (clientCartAliases.size > MAX_CLIENT_CART_ALIASES) {
    const oldest = clientCartAliases.keys().next().value as string | undefined;
    if (!oldest) break;
    clientCartAliases.delete(oldest);
  }
}

export function clearClientCartAlias(clientKey?: string): void {
  if (clientKey) clientCartAliases.delete(clientKey);
}

/** Serializes cart writes within one Node process so rapid taps cannot overwrite stale quantities. */
export async function withKeyedLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.catch(() => undefined).then(() => current);
  queues.set(key, queued);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
    if (queues.get(key) === queued) queues.delete(key);
  }
}
