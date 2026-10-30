import type { Edition, EditionConfiguration } from "./editions";

/** Identity fields may be corrected while an accidental draft is still unused. */
export function isBlankTournamentDraft(e: Edition | EditionConfiguration) {
  const fields = new Set([
    "slug",
    "name",
    "season",
    "timeZone",
    "branding",
    "coachesEnabled",
    "defaultAppearance",
    "archive",
    "published",
    "status",
    "summary",
    "rules",
    "eligibility",
    "automaticEligibility",
    "rankGraceRange",
    "registration",
    "schedule",
  ]);
  return (
    Object.keys(e).every((key) => fields.has(key)) &&
    e.coachesEnabled !== true &&
    !e.published &&
    e.status === "upcoming" &&
    e.summary === "" &&
    !e.rules &&
    !e.eligibility &&
    !e.automaticEligibility &&
    !e.rankGraceRange &&
    !e.registration &&
    e.schedule.length === 0 &&
    !e.archive &&
    !e.defaultAppearance &&
    Object.values(e.branding).every((value) => value === null)
  );
}
