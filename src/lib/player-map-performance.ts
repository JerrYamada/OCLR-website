import { publicArchiveStatistics } from "./archive-statistics";
import type { StatisticsPlay } from "./archive-statistics-model";
import type { PublishedPlayer } from "./players";

/**
 * Player map-performance DEMO model.
 *
 * Only published MP map scores reach this model: the loader reads the public
 * archive statistics projection, which already excludes unpublished snapshots,
 * review-pending imports and excluded scores. Deliberately absent from the
 * output are relative score, maximum combo, miss totals, pass rate, team score
 * share, failed-score counts and any score-system grouping; those are not
 * comparable across maps or seasons.
 */

export type PlayerMapRow = {
  fixtureId: string;
  gameId: number;
  stage: string;
  title: string;
  slot: string;
  at: string | null;
  /** Competition rank on this map (1, 1, 3 for tied scores); null when unknown. */
  placement: number | null;
  accuracy: number | null;
  /**
   * Effective rating: own score ÷ that map's mean score across every recorded
   * player. Null when the map mean is missing, zero or otherwise unusable.
   */
  effectiveRating: number | null;
};

export type PlayerMapEdition = {
  editionSlug: string;
  editionName: string;
  maps: PlayerMapRow[];
  averagePlacement: number | null;
  firstPlaces: number;
  averageAccuracy: number | null;
  averageEffectiveRating: number | null;
  /** Maps that produced a usable effective rating (map mean > 0). */
  ratedMaps: number;
  /** The edition's public statistics projection could not be read. */
  unavailable: boolean;
};

export type PlayerMapPerformance = {
  mapsPlayed: number;
  averagePlacement: number | null;
  firstPlaces: number;
  averageAccuracy: number | null;
  averageEffectiveRating: number | null;
  ratedMaps: number;
  editions: PlayerMapEdition[];
};

const mean = (values: number[]) =>
  values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : null;

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

/** Competition ranking (1, 1, 3), matching standings and the statistics views. */
function placements(
  scores: { osuId: number; total: number }[],
): Map<number, number> {
  const ranked = [...scores].sort((a, b) => b.total - a.total);
  const result = new Map<number, number>();
  for (const score of ranked) {
    if (result.has(score.osuId)) continue;
    const rank =
      ranked.findIndex((candidate) => candidate.total === score.total) + 1;
    result.set(score.osuId, rank);
  }
  return result;
}

/**
 * Ranks each recorded map and measures every participant against that map's
 * field. A map whose mean score is zero or unusable contributes a placement
 * but never an effective rating.
 */
export function mapPerformance(plays: StatisticsPlay[], osuId: number) {
  const games = new Map<number, StatisticsPlay[]>();
  for (const play of plays)
    games.set(play.gameId, [...(games.get(play.gameId) ?? []), play]);
  const rows: PlayerMapRow[] = [];
  for (const [gameId, game] of games) {
    if (!game.some((play) => play.osuId === osuId)) continue;
    const totals = game.map((play) => ({
      osuId: play.osuId,
      total: play.score,
    }));
    const ranks = placements(totals);
    const average = mean(totals.map((total) => total.total));
    const usableAverage =
      average !== null && Number.isFinite(average) && average > 0;
    for (const play of game) {
      if (play.osuId !== osuId) continue;
      const ratio = usableAverage ? play.score / average! : null;
      rows.push({
        fixtureId: play.fixtureId,
        gameId,
        stage: play.stage,
        title: play.title,
        slot: play.slot,
        at: play.at,
        placement: ranks.get(play.osuId) ?? null,
        accuracy: play.accuracy,
        effectiveRating: finite(ratio) ? ratio : null,
      });
    }
  }
  rows.sort(
    (a, b) => (b.at ?? "").localeCompare(a.at ?? "") || b.gameId - a.gameId,
  );
  const rated = rows.filter((row) => finite(row.effectiveRating));
  return {
    rows,
    averagePlacement: mean(
      rows.flatMap((row) => (row.placement === null ? [] : [row.placement])),
    ),
    firstPlaces: rows.filter((row) => row.placement === 1).length,
    averageAccuracy: mean(
      rows.flatMap((row) => (row.accuracy === null ? [] : [row.accuracy])),
    ),
    averageEffectiveRating: mean(rated.map((row) => row.effectiveRating!)),
    ratedMaps: rated.length,
  };
}

export function summarizeMapPerformance(
  editions: PlayerMapEdition[],
): PlayerMapPerformance {
  const sorted = [...editions].sort((a, b) => {
    const left = a.maps.at(-1)?.at ?? "";
    const right = b.maps.at(-1)?.at ?? "";
    return (
      left.localeCompare(right) || a.editionSlug.localeCompare(b.editionSlug)
    );
  });
  const rows = sorted.flatMap((edition) => edition.maps);
  const rated = rows.filter((row) => finite(row.effectiveRating));
  return {
    mapsPlayed: rows.length,
    averagePlacement: mean(
      rows.flatMap((row) => (row.placement === null ? [] : [row.placement])),
    ),
    firstPlaces: rows.filter((row) => row.placement === 1).length,
    averageAccuracy: mean(
      rows.flatMap((row) => (row.accuracy === null ? [] : [row.accuracy])),
    ),
    averageEffectiveRating: mean(rated.map((row) => row.effectiveRating!)),
    ratedMaps: rated.length,
    editions: sorted,
  };
}

/**
 * DEMO: reads only the public archive statistics projection for each season the
 * player appears in. Seasons without published MP statistics report an empty,
 * explicitly unavailable record instead of zero-valued performance.
 */
export async function playerMapPerformance(
  participation: PublishedPlayer[],
): Promise<PlayerMapPerformance> {
  const groups = new Map<string, PublishedPlayer[]>();
  for (const player of participation)
    groups.set(player.editionSlug, [
      ...(groups.get(player.editionSlug) ?? []),
      player,
    ]);
  const editions = await Promise.all(
    [...groups].map(([slug, people]) => editionPerformance(slug, people)),
  );
  return summarizeMapPerformance(editions);
}

async function editionPerformance(
  slug: string,
  people: PublishedPlayer[],
): Promise<PlayerMapEdition> {
  // Coaches are not part of the playing roster; their seasons still appear.
  const roster = people.filter(
    (p) => p.participation !== "coach" && p.role !== "coach",
  );
  const base: PlayerMapEdition = {
    editionSlug: slug,
    editionName: people[0]?.editionName ?? slug,
    maps: [],
    averagePlacement: null,
    firstPlaces: 0,
    averageAccuracy: null,
    averageEffectiveRating: null,
    ratedMaps: 0,
    unavailable: false,
  };
  if (!roster.length) return base;
  try {
    const statistics = await publicArchiveStatistics(slug);
    return {
      ...base,
      ...mapPerformance(statistics.plays, roster[0].osuId),
    };
  } catch {
    return { ...base, unavailable: true };
  }
}
