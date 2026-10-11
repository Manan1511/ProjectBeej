const queues = new Map<string, Promise<unknown>>();

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
