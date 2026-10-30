import { describe, it, expect } from "vitest";
import {
  fixtureForceDeleteBlocker,
  forceDeleteBlockerMessage,
} from "../../src/lib/fixture-force-delete-model";
const empty = () => ({
  results: [] as Record<string, unknown>[],
  resultRevisions: [] as Record<string, unknown>[],
  claims: [] as Record<string, unknown>[],
  history: [] as Record<string, unknown>[],
  dependents: [] as Record<string, unknown>[],
  statistics: [] as Record<string, unknown>[],
});
describe("force deletion protects official dependencies", () => {
  it("allows unapproved draft/submitted data", () => {
    const state = empty();
    state.results = [
      { state: "submitted", published_revision: null, published_at: null },
    ];
    state.resultRevisions = [{ approved_at: null, approved_by: null }];
    state.history = [{ action: "result_submit" }];
    expect(fixtureForceDeleteBlocker(state)).toBeNull();
  });
  it.each([
    { state: "approved" },
    { published_revision: 0 },
    { published_at: "2026-10-30" },
  ])("protects official result state %j", (row) => {
    const state = empty();
    state.results = [row];
    expect(fixtureForceDeleteBlocker(state)).toBe("official_result");
  });
  it.each(["result_approve", "result_approve_publish", "result_publish"])(
    "protects historical %s",
    (action) => {
      const state = empty();
      state.history = [{ action }];
      expect(fixtureForceDeleteBlocker(state)).toBe("official_result");
    },
  );
  it("protects an old approval, a game claim, a bracket reference and published statistics", () => {
    const approval = empty();
    approval.resultRevisions = [{ approved_by: 1, approved_at: "2026-10-30" }];
    expect(fixtureForceDeleteBlocker(approval)).toBe("official_result");
    const claim = empty();
    claim.claims = [{ external_game_id: 1 }];
    expect(fixtureForceDeleteBlocker(claim)).toBe("official_result");
    const bracket = empty();
    bracket.dependents = [{ id: "downstream" }];
    expect(fixtureForceDeleteBlocker(bracket)).toBe("bracket");
    const stats = empty();
    stats.statistics = [{ published: {}, published_at: null }];
    expect(fixtureForceDeleteBlocker(stats)).toBe("published_statistics");
    expect(forceDeleteBlockerMessage((value) => value, "bracket")).toContain(
      "bracket progression",
    );
  });
});
