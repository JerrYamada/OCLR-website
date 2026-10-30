import { describe, expect, it } from "vitest";
import { globalRankTier } from "../../src/lib/rank-tier";

describe("global rank tiers", () => {
  it("maps the organizer's percentage bands to tiers", () => {
    expect(globalRankTier(0)).toBe("radiant");
    expect(globalRankTier(0.0004)).toBe("radiant");
    expect(globalRankTier(0.0005)).toBe("rhodium");
    expect(globalRankTier(0.002)).toBe("rhodium");
    expect(globalRankTier(0.004)).toBe("platinum");
    expect(globalRankTier(0.01)).toBe("gold");
    expect(globalRankTier(0.03)).toBe("silver");
    expect(globalRankTier(0.2)).toBe("bronze");
    expect(globalRankTier(0.4)).toBe("iron");
  });

  it("returns null outside the tiered range or without a percentage", () => {
    expect(globalRankTier(0.5)).toBeNull();
    expect(globalRankTier(1)).toBeNull();
    expect(globalRankTier(null)).toBeNull();
    expect(globalRankTier(undefined)).toBeNull();
    expect(globalRankTier(Number.NaN)).toBeNull();
    expect(globalRankTier(-0.1)).toBeNull();
  });
});
