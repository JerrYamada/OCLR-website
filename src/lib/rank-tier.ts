// Rank tiers mirror osu!'s profile rank colours: a player's standing is
// described by the share of the ranked population above them, not by the raw
// position, because the leaderboard is not linear.
//
// Colours come from osu!'s own tier palette (ppy/osu `OsuColour.cs`); the
// thresholds follow the organizer's list, which keeps Lustrous (rank <= 100)
// unused and stretches the mid tiers compared with osu-web's.
export const globalRankTiers = [
  { tier: "radiant", limit: 0.0005, from: "#ed82ff", to: "#97dcff" },
  { tier: "rhodium", limit: 0.0025, from: "#a0cf96", to: "#d9f8d3" },
  { tier: "platinum", limit: 0.005, from: "#52e0df", to: "#a8f0ef" },
  { tier: "gold", limit: 0.025, from: "#e0c952", to: "#f0e4a8" },
  { tier: "silver", limit: 0.05, from: "#a3a3c2", to: "#e0e0eb" },
  { tier: "bronze", limit: 0.25, from: "#855c47", to: "#b88f7a" },
  { tier: "iron", limit: 0.5, from: "#bab3ab", to: "#dddddd" },
] as const;

import { contrastInk } from "./color-contrast";

export type GlobalRankTier = (typeof globalRankTiers)[number]["tier"];

/**
 * Tier for a `global_rank_percent` value (0..1). `null` means the provider did
 * not report a percentage, or the player sits below the lowest tier.
 */
export function globalRankTier(
  percent: number | null | undefined,
): GlobalRankTier | null {
  if (percent === null || percent === undefined) return null;
  if (!Number.isFinite(percent) || percent < 0) return null;
  for (const { tier, limit } of globalRankTiers) {
    if (percent < limit) return tier;
  }
  return null;
}

function mixHex(a: string, b: string) {
  const channels = [1, 3, 5].map((offset) => {
    const left = parseInt(a.slice(offset, offset + 2), 16);
    const right = parseInt(b.slice(offset, offset + 2), 16);
    return Math.round((left + right) / 2)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

/**
 * Tier gradient endpoints plus readable ink for a `global_rank_percent` value.
 * The ink is the project's WCAG black/white choice against the blended tier
 * colour, so the label stays legible while the gradient scrolls underneath.
 */
export function rankTierPalette(percent: number | null | undefined) {
  const tier = globalRankTier(percent);
  if (!tier) return null;
  const { from, to } = globalRankTiers.find((entry) => entry.tier === tier)!;
  return { tier, from, to, ink: contrastInk(mixHex(from, to)) };
}
