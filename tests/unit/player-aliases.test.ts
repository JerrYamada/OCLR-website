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
  it("keeps short lists inline", () => {
    expect(collapseAliases(["lp_Blue"])).toBe(false);
    expect(collapseAliases(["animelovers", "bob"])).toBe(false);
  });
  it("collapses long or numerous lists", () => {
    expect(collapseAliases(["a", "b", "c"])).toBe(true);
    expect(collapseAliases(["an_unusually_long_previous_username"])).toBe(true);
  });
});
