import { describe, expect, it } from "vitest";
import {
  collapseAliases,
  previousUsernames,
} from "../../src/lib/player-aliases";

describe("previous usernames", () => {
  it("merges profile and roster names without duplicates", () => {
    expect(
      previousUsernames(["lp_Blue"], ["lp_Blue", "Muzi"], "Muziyami"),
    ).toEqual(["lp_Blue", "Muzi"]);
  });
  it("drops the current name regardless of case", () => {
    expect(previousUsernames([], ["muziyami", "old"], "Muziyami")).toEqual([
      "old",
    ]);
  });
  it("keeps up to five names inline", () => {
    expect(collapseAliases(["lp_Blue"])).toBe(false);
    expect(collapseAliases(["animelovers", "bob"])).toBe(false);
    expect(collapseAliases(["Muziyami_old", "咪子", "Muzi"])).toBe(false);
    expect(collapseAliases(["a", "b", "c", "d", "e"])).toBe(false);
  });
  it("collapses six or more names", () => {
    expect(collapseAliases(["a", "b", "c", "d", "e", "f"])).toBe(true);
    expect(
      collapseAliases([
        "alpha_one",
        "beta_two",
        "gamma_three",
        "delta_four",
        "eps",
        "zeta",
      ]),
    ).toBe(true);
  });
});
