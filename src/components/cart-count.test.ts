import { describe, expect, it } from "vitest";
import { createCartCountStore } from "./cart-count";

describe("cart count feedback", () => {
  it("shows pending additions immediately and reconciles with Shopify", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(2, (count) => seen.push(count));

    store.beginAdd("first-add");
    expect(seen.at(-1)).toBe(3);

    store.confirmAdd("first-add", 3);
    expect(seen.at(-1)).toBe(3);
  });

  it("keeps other pending additions visible while one request is confirmed", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(0, (count) => seen.push(count));

    store.beginAdd("first-add");
    store.beginAdd("second-add");
    store.confirmAdd("first-add", 1);

    expect(seen.at(-1)).toBe(2);
  });

  it("rolls back an optimistic count when the add fails", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(4, (count) => seen.push(count));

    store.beginAdd("failed-add");
    expect(seen.at(-1)).toBe(5);

    store.failAdd("failed-add");
    expect(seen.at(-1)).toBe(4);
  });

  it("shows optimistic quantity changes and rolls them back on failure", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(4, (count) => seen.push(count));

    store.beginChange("line-1", 1);
    expect(seen.at(-1)).toBe(5);
    store.failChange("line-1");
    expect(seen.at(-1)).toBe(4);

    store.beginChange("line-1", -2);
    store.confirmChange("line-1", 2);
    expect(seen.at(-1)).toBe(2);
  });

  it("reconciles several queued additions against one authoritative cart count", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(0, (count) => seen.push(count));
    store.beginAdd("initial");
    store.beginAdd("queued-a");
    store.beginAdd("queued-b");

    store.confirmAdds(["initial", "queued-a", "queued-b"], 3);

    expect(seen.at(-1)).toBe(3);
  });

  it("rolls back only the additions in a rejected queued batch", () => {
    const store = createCartCountStore();
    const seen: number[] = [];
    store.subscribe(2, (count) => seen.push(count));
    store.beginAdd("confirmed-add");
    store.confirmAdd("confirmed-add", 3);
    store.beginAdd("queued-a");
    store.beginAdd("queued-b");

    store.failAdds(["queued-a", "queued-b"]);

    expect(seen.at(-1)).toBe(3);
  });
});
