export type MilestoneState = "completed" | "current" | "upcoming";

/**
 * Derive stage state from the edition status and the published milestone times.
 * Dates are authoritative when present. A live edition with no milestone times
 * at all falls back to its first stage so the overview still has an active step;
 * no other missing date is inferred.
 */
export function milestoneStates(
  schedule: readonly { at: string | null }[],
  status: "upcoming" | "live" | "completed",
  now = Date.now(),
): MilestoneState[] {
  if (status === "completed") return schedule.map(() => "completed");
  if (status === "upcoming") return schedule.map(() => "upcoming");

  let current = -1;
  schedule.forEach((event, index) => {
    if (event.at && Date.parse(event.at) <= now) current = index;
  });
  if (current === -1 && schedule.length > 0 && schedule.every((e) => !e.at))
    current = 0;

  return schedule.map((_, index) =>
    index < current ? "completed" : index === current ? "current" : "upcoming",
  );
}
