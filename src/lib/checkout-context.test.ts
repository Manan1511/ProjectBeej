import { describe, expect, it } from "vitest";
import { mergeCheckoutAttributes } from "@/lib/tracking-cart-attributes";

describe("checkout attribute merge", () => {
  it("preserves existing merchant attributes and replaces only the tracking namespace", () => {
    expect(mergeCheckoutAttributes(
      [{ key: "gift_note", value: "Happy birthday" }, { key: "beej_ga_client_id", value: "old" }],
      [{ key: "beej_ga_client_id", value: "new" }, { key: "beej_tracking_context", value: "signed" }],
    )).toEqual([
      { key: "gift_note", value: "Happy birthday" },
      { key: "beej_ga_client_id", value: "new" },
      { key: "beej_tracking_context", value: "signed" },
    ]);
  });

  it("does not duplicate arbitrary customer attributes", () => {
    expect(mergeCheckoutAttributes(
      [{ key: "note", value: "one" }, { key: "note", value: "two" }],
      [],
    )).toEqual([{ key: "note", value: "two" }]);
  });
});
