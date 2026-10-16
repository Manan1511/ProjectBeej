type CartCountListener = (count: number) => void;

function validCount(count: number): number {
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function createCartCountStore() {
  let confirmedCount: number | null = null;
  const pendingAdds = new Set<string>();
  const pendingChanges = new Map<string, number>();
  const listeners = new Set<CartCountListener>();

  function visibleCount() {
    const pendingDelta = [...pendingChanges.values()].reduce((sum, delta) => sum + delta, 0);
    return Math.max(0, (confirmedCount ?? 0) + pendingAdds.size + pendingDelta);
  }

  function notify() {
    const count = visibleCount();
    for (const listener of listeners) listener(count);
  }

  function confirmAdds(requestIds: string[], totalQuantity: number) {
    confirmedCount = validCount(totalQuantity);
    for (const requestId of requestIds) pendingAdds.delete(requestId);
    notify();
  }

  function failAdds(requestIds: string[]) {
    let changed = false;
    for (const requestId of requestIds) changed = pendingAdds.delete(requestId) || changed;
    if (changed) notify();
  }

  return {
    subscribe(initialCount: number, listener: CartCountListener) {
      if (confirmedCount === null) confirmedCount = validCount(initialCount);
      listeners.add(listener);
      listener(visibleCount());
      return () => { listeners.delete(listener); };
    },
    beginAdd(requestId: string) {
      if (pendingAdds.has(requestId)) return;
      pendingAdds.add(requestId);
      notify();
    },
    confirmAdd(requestId: string, totalQuantity: number) {
      confirmAdds([requestId], totalQuantity);
    },
    failAdd(requestId: string) {
      failAdds([requestId]);
    },
    confirmAdds,
    failAdds,
    beginChange(requestId: string, quantityDelta: number) {
      if (!Number.isSafeInteger(quantityDelta) || pendingChanges.has(requestId)) return;
      pendingChanges.set(requestId, quantityDelta);
      notify();
    },
    confirmChange(requestId: string, totalQuantity: number) {
      confirmedCount = validCount(totalQuantity);
      pendingChanges.delete(requestId);
      notify();
    },
    failChange(requestId: string) {
      if (!pendingChanges.delete(requestId)) return;
      notify();
    },
    getCount() {
      return visibleCount();
    },
    setCount(totalQuantity: number) {
      confirmedCount = validCount(totalQuantity);
      notify();
    },
  };
}

export const cartCountStore = createCartCountStore();
