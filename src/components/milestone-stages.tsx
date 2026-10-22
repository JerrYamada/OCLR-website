import type { MilestoneState } from "@/lib/milestone-state";

export type MilestoneStage = {
  name: string;
  date: string;
  state: MilestoneState;
  statusLabel: string;
};

/** Reference-style connected stage tracker; one row, scrollable on narrow screens. */
export function MilestoneStages({
  title,
  subtitle,
  label,
  stages,
}: {
  title: string;
  subtitle: string;
  label: string;
  stages: MilestoneStage[];
}) {
  return (
    <section className="event-stages" aria-labelledby="event-stages-title">
      <div className="event-stages-heading">
        <h2 id="event-stages-title">{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div
        className="event-stages-scroll"
        role="group"
        aria-label={label}
        tabIndex={0}
      >
        <ol className="event-stage-track">
          {stages.map((stage, index) => (
            <li
              key={`${stage.name}-${index}`}
              className={`event-stage is-${stage.state}`}
              aria-current={stage.state === "current" ? "step" : undefined}
            >
              <span className="event-stage-dot" aria-hidden="true">
                {stage.state === "completed" ? "✓" : index + 1}
              </span>
              <span className="event-stage-name">{stage.name}</span>
              <span className="event-stage-date">{stage.date}</span>
              <span className="sr-only"> — {stage.statusLabel}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
