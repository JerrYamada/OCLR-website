import { describe, expect, it } from "vitest";
import type { StatisticsPlay } from "../../src/lib/archive-statistics-model";
import {
  mapPerformance,
  summarizeMapPerformance,
  type PlayerMapEdition,
} from "../../src/lib/player-map-performance";

function play(
  gameId: number,
  osuId: number,
  score: number,
  accuracy: number | null = 0.95,
  at = "2024-01-05T00:00:00Z",
): StatisticsPlay {
  return {
    fixtureId: "fixture",
    mpId: 1,
    gameId,
    stage: "小组赛",
    beatmapId: 1000 + gameId,
    title: `Map ${gameId}`,
    slot: `NM${gameId}`,
    at,
    osuId,
    teamId: "a",
    score,
    scoringType: "score",
    accuracy,
    combo: 500,
    passed: true,
    mods: [],
    hits: { great: 1, ok: 1, meh: 0, miss: 0 },
    relative: null,
  };
}

function edition(
  slug: string,
  maps: PlayerMapEdition["maps"],
  unavailable = false,
): PlayerMapEdition {
  const row = summarizeMapPerformance([{ ...blank(slug), maps }]).editions[0];
  return { ...row, unavailable };
}

function blank(slug: string): PlayerMapEdition {
  return {
    editionSlug: slug,
    editionName: slug.toUpperCase(),
    maps: [],
    averagePlacement: null,
    firstPlaces: 0,
    averageAccuracy: null,
    averageEffectiveRating: null,
    ratedMaps: 0,
    unavailable: false,
  };
}

describe("map performance", () => {
  it("ranks each map with competition ranking and keeps ties shared", () => {
    const result = mapPerformance(
      [
        play(1, 1, 1_000_000),
        play(1, 2, 800_000),
        play(1, 3, 800_000),
        play(1, 4, 500_000),
      ],
      3,
    );
    expect(result.rows[0].placement).toBe(2);
    expect(
      mapPerformance([play(2, 1, 900), play(2, 2, 1_000)], 1).rows[0].placement,
    ).toBe(2);
  });

  it("computes effective rating as own score over the map mean", () => {
    const result = mapPerformance(
      [play(1, 1, 1_000_000), play(1, 2, 800_000), play(1, 3, 600_000)],
      1,
    );
    // Mean = 800,000; own score = 1,000,000 → 1.25.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].effectiveRating).toBeCloseTo(1.25);
    expect(result.averageEffectiveRating).toBeCloseTo(1.25);
    expect(result.ratedMaps).toBe(1);
  });

  it("skips effective ratings when the map mean is zero or unusable", () => {
    const result = mapPerformance(
      [play(1, 1, 0), play(1, 2, 0), play(2, 3, 500), play(2, 1, 1_000)],
      1,
    );
    const zeroMap = result.rows.find((row) => row.gameId === 1)!;
    expect(zeroMap.placement).toBe(1);
    expect(zeroMap.effectiveRating).toBeNull();
    // Mean of map 2 is 750, so only that map contributes 1.333…
    expect(result.averageEffectiveRating).toBeCloseTo(1_000 / 750);
    expect(result.ratedMaps).toBe(1);
  });

  it("averages placements, first places and accuracy over recorded maps", () => {
    const result = mapPerformance(
      [
        play(1, 1, 1_000_000, 0.98, "2024-01-05T00:00:00Z"),
        play(1, 2, 500_000),
        play(2, 1, 400_000, 0.9, "2024-01-12T00:00:00Z"),
        play(2, 2, 900_000),
        play(3, 1, 700_000, null, "2024-01-20T00:00:00Z"),
        play(3, 2, 300_000),
      ],
      1,
    );
    expect(result.rows).toHaveLength(3);
    expect(result.averagePlacement).toBeCloseTo((1 + 2 + 1) / 3);
    expect(result.firstPlaces).toBe(2);
    expect(result.averageAccuracy).toBeCloseTo((0.98 + 0.9) / 2);
    // Rows are newest first.
    expect(result.rows.map((row) => row.gameId)).toEqual([3, 2, 1]);
  });

  it("summarizes editions and ignores empty or unavailable seasons", () => {
    const first = mapPerformance([play(1, 1, 1_000), play(1, 2, 1_000)], 1);
    const summary = summarizeMapPerformance([
      edition("s2", []),
      edition("s1", first.rows),
    ]);
    expect(summary.mapsPlayed).toBe(1);
    expect(summary.firstPlaces).toBe(1);
    expect(summary.ratedMaps).toBe(1);
    expect(summary.averageEffectiveRating).toBeCloseTo(1);
    expect(summary.editions.map((item) => item.editionSlug)).toEqual([
      "s2",
      "s1",
    ]);
  });
});
