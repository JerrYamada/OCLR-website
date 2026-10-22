import { describe, expect, it } from "vitest";
import { milestoneStates } from "../../src/lib/milestone-state";

const now = new Date("2026-11-15T12:00:00Z").getTime();
const schedule = [
  { at: "2026-11-01T12:00:00Z" },
  { at: "2026-11-10T12:00:00Z" },
  { at: "2026-11-20T12:00:00Z" },
  { at: null },
];

describe("milestone states", () => {
  it("marks every stage completed for a completed edition", () => {
    expect(milestoneStates(schedule, "completed", now)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
  });

  it("marks every stage upcoming for an upcoming edition", () => {
    expect(milestoneStates(schedule, "upcoming", now)).toEqual([
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("uses started dates for a live edition", () => {
    expect(milestoneStates(schedule, "live", now)).toEqual([
      "completed",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("uses the first stage as current only when a live edition has no dates", () => {
    expect(milestoneStates([{ at: null }, { at: null }], "live", now)).toEqual([
      "current",
      "upcoming",
    ]);
  });

  it("does not infer a current stage from a mix of missing and future dates", () => {
    expect(
      milestoneStates(
        [{ at: null }, { at: "2026-12-01T00:00:00Z" }],
        "live",
        now,
      ),
    ).toEqual(["upcoming", "upcoming"]);
  });

  it("handles empty and invalid schedules", () => {
    expect(milestoneStates([], "live", now)).toEqual([]);
    expect(
      milestoneStates(
        [{ at: "not-a-date" }, { at: "2026-11-01T00:00:00Z" }],
        "live",
        now,
      ),
    ).toEqual(["completed", "current"]);
  });
});
