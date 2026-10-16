import { describe, expect, it, vi } from "vitest";
import { serializeCartWrite } from "./cart-request";

describe("cart write scheduling", () => {
  it("keeps bag writes ordered without making Buy now wait behind them", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const firstBagWrite = serializeCartWrite(async () => {
      events.push("bag-1-start");
      await firstGate;
      events.push("bag-1-end");
    }, "bag-test");
    const secondBagWrite = serializeCartWrite(async () => { events.push("bag-2"); }, "bag-test");
    const buyNow = serializeCartWrite(async () => { events.push("buy-now"); }, "buy-now");

    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(events).toEqual(["bag-1-start", "buy-now"]);
    } finally {
      releaseFirst();
      await Promise.all([firstBagWrite, secondBagWrite, buyNow]);
    }
    expect(events).toEqual(["bag-1-start", "buy-now", "bag-1-end", "bag-2"]);
  });

  it("continues a queue after an earlier operation fails", async () => {
    const events: string[] = [];
    const failed = serializeCartWrite(async () => { events.push("failed"); throw new Error("offline"); }, "failure-test");
    const next = serializeCartWrite(async () => { events.push("next"); return 2; }, "failure-test");

    await expect(failed).rejects.toThrow("offline");
    await expect(next).resolves.toBe(2);
    expect(events).toEqual(["failed", "next"]);
  });

  it("records queue wait and network duration as browser performance measures", async () => {
    const measure = vi.spyOn(performance, "measure");

    await serializeCartWrite(async () => undefined, "timing-test");

    expect(measure).toHaveBeenCalledWith("beej:cart:timing-test:queue", expect.objectContaining({ start: expect.any(Number), end: expect.any(Number) }));
    expect(measure).toHaveBeenCalledWith("beej:cart:timing-test:request", expect.objectContaining({ start: expect.any(Number), end: expect.any(Number) }));
    measure.mockRestore();
  });
});
