import { describe, expect, it } from "vitest";
import {
  s11RefereeDefaults,
  s11RefereeSteps,
} from "../../src/lib/referee-defaults";
import { refereePolicySchema } from "../../src/lib/referee-model";

describe("S11 editable referee defaults", () => {
  it.each([6, 7])(
    "uses the configured first-to %i without guessing the round label",
    (wins) => {
      const defaults = s11RefereeDefaults("11", { type: "first_to", wins })!;
      expect(refereePolicySchema.safeParse(defaults.policy).success).toBe(true);
      expect(
        defaults.policy.steps.map((step) => step.kind).slice(0, 6),
      ).toEqual(["ban", "ban", "pick", "pick", "ban", "ban"]);
      expect(
        defaults.policy.steps.filter((step) => step.kind === "pick"),
      ).toHaveLength((wins - 1) * 2);
      expect(defaults.policy.steps.at(-1)).toMatchObject({
        kind: "tb",
        actor: "neutral",
        categories: ["TB"],
        tiedAt: wins - 1,
      });
      expect(defaults.commands).toMatchObject({
        noFail: true,
        banSeconds: 60,
        pickSeconds: 90,
        prepareSeconds: 120,
        startSeconds: null,
      });
      expect(defaults.commands).not.toHaveProperty("roomSize");
      expect(defaults.policy).not.toHaveProperty("maxReplaysPerMap");
      expect(defaults.commands.categoryMods.HD).toEqual({
        mods: ["HD"],
        freemod: false,
      });
      expect(defaults.commands.categoryMods.FM.freemod).toBe(true);
      expect(defaults.commands.categoryMods.TB.freemod).toBe(true);
    },
  );
  it("does not create defaults for other seasons or unknown series", () => {
    expect(s11RefereeDefaults("10", { type: "first_to", wins: 6 })).toBeNull();
    expect(s11RefereeDefaults("11", null)).toBeNull();
    expect(s11RefereeDefaults("11", { type: "first_to", wins: 5 })).toBeNull();
  });
  it("creates independent editable copies and supports an explicitly selected opening-ban order", () => {
    const first = s11RefereeDefaults("11", { type: "first_to", wins: 6 })!;
    first.policy.steps.pop();
    first.commands.categoryMods.NM.mods.push("HD");
    const second = s11RefereeDefaults("11", { type: "first_to", wins: 6 })!;
    expect(second.policy.steps.at(-1)?.kind).toBe("tb");
    expect(second.commands.categoryMods.NM.mods).toEqual([]);
    expect(
      s11RefereeSteps(6, "opening")
        .slice(0, 4)
        .every((step) => step.kind === "ban"),
    ).toBe(true);
  });
});
