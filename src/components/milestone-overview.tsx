"use client";

import { useAppTranslations } from "@/i18n/shared";
import type { MilestoneState } from "@/lib/milestone-state";

const stateLabel = {
  completed: "Completed",
  current: "Live",
  upcoming: "Upcoming",
} as const;

/**
 * Compact carousel-style stage overview. Each cell jumps the milestone rail to
 * that stage; the dot colour communicates completed / current / upcoming.
 */
export function MilestoneOverview({
  events,
  states,
}: {
  events: { label: string }[];
  states: MilestoneState[];
}) {
  const tr = useAppTranslations();

  function reveal(index: number) {
    const rail = document.querySelector<HTMLElement>("[data-milestone-rail]");
    const card = rail?.children[index];
    if (!rail || !(card instanceof HTMLElement)) return;
    const left =
      card.getBoundingClientRect().left -
      rail.getBoundingClientRect().left +
      rail.scrollLeft;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    rail.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <ol className="event-stage-overview" aria-label={tr("Milestones")}>
      {events.map((event, index) => {
        const state = states[index] ?? "upcoming";
        const label = tr(stateLabel[state]);
        return (
          <li
            key={`${event.label}-${index}`}
            className={`event-stage-overview-cell is-${state}`}
          >
            <button
              type="button"
              className="event-stage-overview-button"
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`${event.label} — ${label}`}
              title={event.label}
              onClick={() => reveal(index)}
            >
              <span className="event-stage-overview-dot" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="event-stage-overview-name">
                {event.label.split(" · ")[0]}
              </span>
              <span className="event-stage-overview-state">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
