import { describe, expect, it } from "vitest";
import { canIncreaseProductCardQuantity, canQueueAnotherAdd, initialProductCardCartState, productCardCartReducer } from "./product-card-cart-state";

describe("product card cart controls", () => {
  it("switches to quantity one as soon as an add starts", () => {
    const state = productCardCartReducer(initialProductCardCartState, { type: "add-start" });

    expect(state).toEqual({ quantity: 1, lineId: null, busy: true });
  });

  it("allows another add while the first request has not returned its line id", () => {
    const pending = productCardCartReducer(initialProductCardCartState, { type: "add-start" });
    const queued = productCardCartReducer(pending, { type: "add-queue" });

    expect(canQueueAnotherAdd(pending)).toBe(true);
    expect(canIncreaseProductCardQuantity(pending)).toBe(true);
    expect(queued).toEqual({ quantity: 2, lineId: null, busy: true });
    expect(canQueueAnotherAdd({ quantity: 10, lineId: null, busy: true })).toBe(false);
    expect(canQueueAnotherAdd({ quantity: 2, lineId: "line-1", busy: true })).toBe(false);
  });

  it("caps queued adds at ten", () => {
    const state = { quantity: 10, lineId: null, busy: true };

    expect(productCardCartReducer(state, { type: "add-queue" })).toBe(state);
    expect(canQueueAnotherAdd(state)).toBe(false);
    expect(canIncreaseProductCardQuantity(state)).toBe(false);
  });

  it("disables quantity changes only while a confirmed cart write is pending", () => {
    expect(canIncreaseProductCardQuantity({ quantity: 2, lineId: "line-1", busy: true })).toBe(false);
    expect(canIncreaseProductCardQuantity({ quantity: 2, lineId: "line-1", busy: false })).toBe(true);
  });

  it("uses the Shopify line quantity and id after a successful add", () => {
    const pending = productCardCartReducer(initialProductCardCartState, { type: "add-start" });
    const state = productCardCartReducer(pending, { type: "add-success", line: { id: "line-1", quantity: 3 } });

    expect(state).toEqual({ quantity: 3, lineId: "line-1", busy: false });
  });

  it("restores the add button when Shopify rejects an add", () => {
    const pending = productCardCartReducer(initialProductCardCartState, { type: "add-start" });
    const state = productCardCartReducer(pending, { type: "add-failure" });

    expect(state).toEqual(initialProductCardCartState);
  });

  it("keeps the last confirmed quantity when a quantity update fails", () => {
    const current = { quantity: 2, lineId: "line-1", busy: false };
    const pending = productCardCartReducer(current, { type: "change-start", quantity: 3 });
    expect(pending).toEqual({ quantity: 3, lineId: "line-1", busy: true });
    const state = productCardCartReducer(pending, { type: "change-failure", quantity: 2 });

    expect(state).toEqual(current);
  });
});
