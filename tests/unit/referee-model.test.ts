import { describe, it, expect } from "vitest";
import {
  projectReferee,
  validateRefereeAction,
  refereeOrderConflicts,
  refereePolicySchema,
  type RefereeModelInput,
  type RefereeEventPayload,
  type RefereeAction,
} from "../../src/lib/referee-model";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function input(): RefereeModelInput {
  return {
    policy: {
      commands: null,
      steps: [
        {
          kind: "ban",
          actor: "firstBan",
          categories: [],
          entryIds: [],
          avoidRepeatCategory: false,
          tiedAt: null,
        },
        {
          kind: "pick",
          actor: "firstPick",
          categories: [],
          entryIds: [],
          avoidRepeatCategory: false,
          tiedAt: null,
        },
        {
          kind: "ban",
          actor: "secondBan",
          categories: [],
          entryIds: [],
          avoidRepeatCategory: false,
          tiedAt: null,
        },
        {
          kind: "pick",
          actor: "secondPick",
          categories: [],
          entryIds: [],
          avoidRepeatCategory: false,
          tiedAt: null,
        },
        {
          kind: "tb",
          actor: "neutral",
          categories: ["TB"],
          entryIds: [],
          avoidRepeatCategory: false,
          tiedAt: 1,
        },
      ],
    },
    orders: { firstBanTeamId: a, firstPickTeamId: b },
    events: [],
    teamIds: [a, b],
    maps: Array.from({ length: 6 }, (_, i) => ({
      id: id(i + 10),
      beatmapId: i + 100,
      category: i === 5 ? "TB" : "NM",
      position: i + 1,
    })),
    series: { type: "first_to", wins: 2 },
  };
}
function append(i: RefereeModelInput, payload: RefereeEventPayload) {
  const event = {
    id: id(100 + i.events.length),
    ordinal: i.events.length + 1,
    actorId: 1,
    createdAt: "2026-01-01T00:00:00Z",
    payload,
  };
  i.events.push(event);
  return event.id;
}
function act(i: RefereeModelInput, a: RefereeAction) {
  return append(i, validateRefereeAction(i, a));
}
describe("referee finite workflow", () => {
  it("allows two replays per map and rejects a third without adding an attempt", () => {
    const i = input();
    i.policy!.maxReplaysPerMap = 2;
    act(i, { action: "record_selection", entryId: id(10) });
    const pickId = act(i, { action: "record_selection", entryId: id(11) });
    for (let replay = 0; replay < 2; replay++) {
      act(i, {
        action: "resolve_attempt",
        pickId,
        status: "aborted",
        winnerTeamId: null,
      });
      act(i, { action: "replay_attempt", pickId });
    }
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "aborted",
      winnerTeamId: null,
    });
    expect(() => act(i, { action: "replay_attempt", pickId })).toThrow(
      "The replay limit for this map has been reached.",
    );
    expect(projectReferee(i).activeSelections.at(-1)?.attempts).toHaveLength(3);
  });
  it.each([
    [a, a],
    [a, b],
    [b, a],
    [b, b],
  ])("keeps ban %s and pick %s independent", (ban, pick) => {
    const i = input();
    expect(
      validateRefereeAction(i, {
        action: "set_order",
        firstBanTeamId: ban,
        firstPickTeamId: pick,
      }),
    ).toEqual({
      type: "order_set",
      firstBanTeamId: ban,
      firstPickTeamId: pick,
    });
    i.orders = { firstBanTeamId: ban, firstPickTeamId: pick };
    expect(projectReferee(i).nextStep?.teamId).toBe(ban);
    act(i, { action: "record_selection", entryId: id(10) });
    expect(projectReferee(i).nextStep?.teamId).toBe(pick);
  });
  it("allows changing unused pick order but refuses to relabel a recorded ban", () => {
    const i = input();
    act(i, { action: "record_selection", entryId: id(10) });
    expect(
      refereeOrderConflicts(i, { firstBanTeamId: a, firstPickTeamId: a }),
    ).toEqual([]);
    expect(() =>
      validateRefereeAction(i, {
        action: "set_order",
        firstBanTeamId: b,
        firstPickTeamId: a,
      }),
    ).toThrow("1");
  });
  it("records opponent wins and replay attempts without adding a pick", () => {
    const i = input();
    act(i, { action: "record_selection", entryId: id(10) });
    const pickId = act(i, { action: "record_selection", entryId: id(11) });
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "completed",
      winnerTeamId: a,
    });
    expect(projectReferee(i).score[a]).toBe(1);
    act(i, { action: "replay_attempt", pickId });
    expect(projectReferee(i).score[a]).toBe(0);
    expect(projectReferee(i).activeSelections).toHaveLength(2);
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "aborted",
      winnerTeamId: null,
    });
    act(i, { action: "replay_attempt", pickId });
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "completed",
      winnerTeamId: b,
    });
    expect(projectReferee(i).score).toEqual({ [a]: 0, [b]: 1 });
    expect(projectReferee(i).activeSelections[1].attempts).toHaveLength(3);
    expect(projectReferee(i).nextStep?.kind).toBe("ban");
  });
  it("keeps tied and incomplete attempts out of the score and blocks advancement", () => {
    const i = input();
    act(i, { action: "record_selection", entryId: id(10) });
    const pickId = act(i, { action: "record_selection", entryId: id(11) });
    expect(() =>
      act(i, { action: "record_selection", entryId: id(12) }),
    ).toThrow("Resolve");
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "tied",
      winnerTeamId: null,
    });
    expect(projectReferee(i).score).toEqual({ [a]: 0, [b]: 0 });
    expect(() =>
      act(i, {
        action: "resolve_attempt",
        pickId,
        status: "tied",
        winnerTeamId: a,
      }),
    ).toThrow("no winner");
  });
  it("undo restores map availability and retains every historical attempt", () => {
    const i = input();
    act(i, { action: "record_selection", entryId: id(10) });
    const pickId = act(i, { action: "record_selection", entryId: id(11) });
    act(i, {
      action: "resolve_attempt",
      pickId,
      status: "completed",
      winnerTeamId: b,
    });
    act(i, { action: "void_last" });
    expect(projectReferee(i).selections[1].voided).toBe(true);
    expect(projectReferee(i).selections[1].attempts).toHaveLength(1);
    expect(projectReferee(i).score[b]).toBe(0);
    expect(() =>
      act(i, { action: "record_selection", entryId: id(11) }),
    ).not.toThrow();
  });
  it("enforces category, map, team and duplicate restrictions", () => {
    const i = input();
    expect(() =>
      act(i, {
        action: "set_order",
        firstBanTeamId: id(99),
        firstPickTeamId: b,
      }),
    ).toThrow();
    expect(() =>
      act(i, { action: "record_selection", entryId: id(99) }),
    ).toThrow();
    act(i, { action: "record_selection", entryId: id(10) });
    expect(() =>
      act(i, { action: "record_selection", entryId: id(10) }),
    ).toThrow("already");
    i.policy!.steps[1].categories = ["HD"];
    expect(() =>
      act(i, { action: "record_selection", entryId: id(11) }),
    ).toThrow("category");
  });
  it("reaches neutral TB only at its explicitly configured tied score", () => {
    const i = input();
    act(i, { action: "record_selection", entryId: id(10) });
    let p = act(i, { action: "record_selection", entryId: id(11) });
    act(i, {
      action: "resolve_attempt",
      pickId: p,
      status: "completed",
      winnerTeamId: a,
    });
    act(i, { action: "record_selection", entryId: id(12) });
    p = act(i, { action: "record_selection", entryId: id(13) });
    act(i, {
      action: "resolve_attempt",
      pickId: p,
      status: "completed",
      winnerTeamId: b,
    });
    expect(projectReferee(i).issues).toEqual([]);
    expect(projectReferee(i).nextStep?.teamId).toBeNull();
    expect(() =>
      act(i, { action: "record_selection", entryId: id(14) }),
    ).toThrow("category");
    p = act(i, { action: "record_selection", entryId: id(15) });
    act(i, {
      action: "resolve_attempt",
      pickId: p,
      status: "completed",
      winnerTeamId: a,
    });
    expect(projectReferee(i).complete).toBe(true);
  });
  it("rejects incomplete configuration and incompatible TB", () => {
    const i = input();
    i.policy = null;
    expect(() =>
      act(i, { action: "record_selection", entryId: id(10) }),
    ).toThrow("policy");
    const j = input();
    j.policy!.steps[4].tiedAt = 4;
    expect(projectReferee(j).issues).toContain(
      "The tiebreak condition is incompatible with the round series.",
    );
    expect(
      refereePolicySchema.safeParse({ commands: null, steps: [] }).success,
    ).toBe(false);
  });
  it("supports a configured fixed map series", () => {
    const i = input();
    i.series = { type: "fixed_maps", count: 1, allowDraw: false };
    act(i, { action: "record_selection", entryId: id(10) });
    const p = act(i, { action: "record_selection", entryId: id(11) });
    act(i, {
      action: "resolve_attempt",
      pickId: p,
      status: "completed",
      winnerTeamId: a,
    });
    expect(projectReferee(i).complete).toBe(true);
  });
  it("counts a permitted tied map toward fixed-map completion without awarding either team", () => {
    const i = input();
    i.series = { type: "fixed_maps", count: 1, allowDraw: true };
    i.tiedMapPolicy = "count_as_draw";
    act(i, { action: "record_selection", entryId: id(10) });
    const p = act(i, { action: "record_selection", entryId: id(11) });
    act(i, {
      action: "resolve_attempt",
      pickId: p,
      status: "tied",
      winnerTeamId: null,
    });
    expect(projectReferee(i).complete).toBe(true);
    expect(projectReferee(i).score).toEqual({ [a]: 0, [b]: 0 });
  });
  it("reserves configured TB maps from early picks and bans", () => {
    const i = input();
    expect(() =>
      act(i, { action: "record_selection", entryId: id(15) }),
    ).toThrow("reserved");
    act(i, { action: "record_selection", entryId: id(10) });
    expect(() =>
      act(i, { action: "record_selection", entryId: id(15) }),
    ).toThrow("reserved");
    i.policy!.steps[4].categories = [];
    expect(refereePolicySchema.safeParse(i.policy).success).toBe(false);
  });
});
