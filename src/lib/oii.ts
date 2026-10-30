import type { ProfileMode, ProfileSnapshot } from "./osu-profile-model";

/**
 * Organizer formula: the play time (hours) a player usually needs to reach a
 * given pp level. Each ruleset has its own quadratic; the relax and autopilot
 * variants share their base ruleset's curve, and an unknown mode falls back to
 * osu!standard.
 */
const expectedPlayTimeCurves: Record<ProfileMode, [number, number, number]> = {
  osu: [-12.0, 0.0781, 6.01e-6],
  taiko: [-1.08, 0.0179, 1.65e-6],
  fruits: [-4.14, 0.0458, 2.38e-6],
  mania: [-0.601, 0.0321, 7.69e-7],
};

export function expectedPlayHours(pp: number, mode: ProfileMode): number {
  const [offset, linear, quadratic] = expectedPlayTimeCurves[mode];
  return offset + linear * pp + quadratic * pp * pp;
}

/**
 * OII (improvement index): expected play time for the current pp divided by the
 * account's actual play time. Above 1 means the player reached this pp in less
 * time than the curve predicts.
 */
export function calculateOii(
  pp: number | null | undefined,
  playTimeSeconds: number | null | undefined,
  mode: ProfileMode,
): number | null {
  if (typeof pp !== "number" || !Number.isFinite(pp) || pp < 0) return null;
  if (
    typeof playTimeSeconds !== "number" ||
    !Number.isFinite(playTimeSeconds) ||
    playTimeSeconds <= 0
  )
    return null;
  const hours = playTimeSeconds / 3600;
  if (!(hours > 0)) return null;
  const expected = expectedPlayHours(pp, mode);
  return Number.isFinite(expected) ? expected / hours : null;
}

/**
 * The ranked history's ruleset wins over the requested mode: the card sits next
 * to that chart, so the index describes the same ruleset.
 */
export function oiiMode(snapshot: ProfileSnapshot): ProfileMode {
  return snapshot.profile.rankHistory?.mode ?? snapshot.profile.ruleset;
}
