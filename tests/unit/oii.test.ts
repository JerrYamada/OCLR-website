import { describe, expect, it } from "vitest";
import { calculateOii, expectedPlayHours, oiiMode } from "../../src/lib/oii";
import type { ProfileMode, ProfileSnapshot } from "../../src/lib/osu-profile-model";

describe("improvement index (OII)", () => {
  it("uses the organizer curve for every ruleset", () => {
    // The relax/autopilot variants share their base ruleset's quadratic.
    expect(expectedPlayHours(1000, "osu")).toBeCloseTo(-12 + 78.1 + 6.01, 6);
    expect(expectedPlayHours(1000, "taiko")).toBeCloseTo(-1.08 + 17.9 + 1.65, 6);
    expect(expectedPlayHours(1000, "fruits")).toBeCloseTo(-4.14 + 45.8 + 2.38, 6);
    expect(expectedPlayHours(1000, "mania")).toBeCloseTo(-0.601 + 32.1 + 0.769, 6);
  });
  it("divides expected play time by the actual play time", () => {
    // osu!, 1000 pp, 100 hours played: 72.11 expected hours / 100.
    expect(calculateOii(1000, 100 * 3600, "osu")).toBeCloseTo(
      (-12 + 0.0781 * 1000 + 6.01e-6 * 1e6) / 100,
      10,
    );
  });
  it("returns null when pp or play time is missing", () => {
    expect(calculateOii(null, 3600, "osu")).toBeNull();
    expect(calculateOii(1000, null, "osu")).toBeNull();
    expect(calculateOii(1000, 0, "osu")).toBeNull();
    expect(calculateOii(Number.NaN, 3600, "osu")).toBeNull();
    expect(calculateOii(-1, 3600, "osu")).toBeNull();
  });
  it("prefers the rank history ruleset over the requested mode", () => {
    const snapshot = {
      profile: {
        ruleset: "osu",
        rankHistory: { mode: "taiko", data: [1, 2, 3] },
      },
    } as unknown as ProfileSnapshot;
    expect(oiiMode(snapshot)).toBe("taiko");
    const noHistory = { profile: { ruleset: "mania", rankHistory: null } };
    expect(oiiMode(noHistory as unknown as ProfileSnapshot)).toBe(
      "mania" as ProfileMode,
    );
  });
});
