import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("development browser origin", () => {
  it("allows the explicit local storefront URL used for preview", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});
