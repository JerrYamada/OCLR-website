import { ProfileInfo } from "./profile-info";
import { useAppTranslations } from "@/i18n/shared";
import type { BwsSummary as Summary } from "@/lib/bws-model";

function BwsNote({ value }: { value: Summary }) {
  const tr = useAppTranslations();
  return (
    <>
      <p className="small muted">
        <code>{"globalRank ^ (0.9937 ^ (badges ^ 2))"}</code>
      </p>
      <p className="small muted">
        <code>{"pp^(1.0063^(badges^2)/1)"}</code>
      </p>
      <p className="small muted">
        {value.badgeCount === null
          ? tr("Badge eligibility pending staff review")
          : tr("Eligible tournament badges: {count}", {
              count: value.badgeCount,
            })}
      </p>
      <p className="small muted">
        {tr(
          "Informational for the selected ruleset, not a leaderboard position or registration decision.",
        )}{" "}
        <a
          className="text-link"
          href="https://osu.ppy.sh/wiki/en/Tournaments/Badge-weighted_seeding"
        >
          {tr("BWS formula")}
        </a>
      </p>
      <p className="small muted">
        {value.reviewedAt
          ? tr("Staff-reviewed badge classification")
          : value.badgeCount === 0
            ? tr("Provider returned no profile badges")
            : tr("Tournament badge types are not supplied by osu!")}
        {value.reviewedAt && (
          <>
            {" "}
            · <time dateTime={value.reviewedAt}>{value.reviewedAt}</time>
          </>
        )}
      </p>
      <p className="small muted">
        {tr("Profile updated")}{" "}
        <time dateTime={value.fetchedAt}>{value.fetchedAt}</time>
        {value.stale && <> · {tr("Stale snapshot")}</>}
      </p>
    </>
  );
}

function RankValue({ value }: { value: string }) {
  return (
    <strong className="bws-value">
      <span className="bws-value-hash">#</span>
      {value}
    </strong>
  );
}

function InfoTrigger({ onOpenLabel }: { onOpenLabel: string }) {
  return (
    <button
      type="button"
      className="bws-card-note-trigger"
      aria-label={onOpenLabel}
    >
      <svg
        className="bws-card-note-icon"
        viewBox="0 0 16 16"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          cx="8"
          cy="8"
          r="6.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
        <path
          d="M8 7.1v4.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/**
 * Compact badge-weighted seeding card overlaid on the player cover: BWS, the
 * plain country rank and weighted pp side by side, the original rank/pp in small
 * parentheses, and all explanatory copy behind the `i` trigger (same disclosure
 * pattern as map notes).
 */
function CompactBwsSummary({
  value,
  countryRank,
}: {
  value: Summary;
  countryRank: number | null;
}) {
  const tr = useAppTranslations();
  const number = (v: number, digits: number) =>
    new Intl.NumberFormat(tr.locale, {
      maximumFractionDigits: digits,
      notation: v >= 1e12 ? "scientific" : "standard",
    }).format(v);
  // Until staff review badges the weighting is unknown, so the card shows the
  // plain rank and pp instead of a badge-review placeholder.
  const pending = value.status === "pending";
  return (
    <section
      className="bws-card"
      aria-label={tr("Badge-weighted seeding")}
      role="group"
    >
      <div className="bws-card-metric">
        <div className="bws-card-label-row">
          <span className="bws-card-label">{pending ? "pp" : tr("BW-PP")}</span>
          {value.rawPp !== null && (
            <div className="bws-card-note">
              <InfoTrigger onOpenLabel={tr("Explanation")} />
              <div className="bws-card-note-panel" role="note">
                <p className="small muted">
                  {tr("Original pp")}: {number(value.rawPp, 2)}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="bws-card-value-row">
          {value.adjustedPp !== null ? (
            <strong className="bws-value">
              {number(Math.floor(value.adjustedPp), 0)}
            </strong>
          ) : pending && value.rawPp !== null ? (
            <strong className="bws-value">{number(value.rawPp, 2)}</strong>
          ) : (
            <span className="bws-card-state">
              {value.ppStatus === "pending"
                ? tr("Badge eligibility pending staff review")
                : tr("Weighted pp unavailable (missing data or numeric limit)")}
            </span>
          )}
        </div>
      </div>
      <span className="bws-card-divider" aria-hidden="true" />
      <div className="bws-card-metric">
        <div className="bws-card-label-row">
          <span className="bws-card-label">
            {pending ? tr("Global rank") : tr("BW-rank")}
          </span>
          <div className="bws-card-note">
            <InfoTrigger onOpenLabel={tr("Explanation")} />
            <div className="bws-card-note-panel" role="note">
              <BwsNote value={value} />
            </div>
          </div>
        </div>
        <div className="bws-card-value-row">
          {value.value !== null ? (
            <RankValue value={number(value.value, 0)} />
          ) : pending && value.globalRank !== null ? (
            <RankValue value={number(value.globalRank, 0)} />
          ) : (
            <span className="bws-card-state">
              {value.status === "unranked"
                ? tr("Unranked / unavailable")
                : tr("Badge eligibility pending staff review")}
            </span>
          )}
        </div>
      </div>
      <span className="bws-card-divider" aria-hidden="true" />
      <div className="bws-card-metric">
        <span className="bws-card-label">{tr("Country rank")}</span>
        <div className="bws-card-value-row">
          {countryRank !== null ? (
            <RankValue value={number(countryRank, 0)} />
          ) : (
            <span className="bws-card-state">
              {tr("Unranked / unavailable")}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

export function BwsSummary({
  value,
  variant = "detail",
  countryRank = null,
}: {
  value: Summary;
  variant?: "detail" | "compact";
  countryRank?: number | null;
}) {
  const tr = useAppTranslations();
  if (variant === "compact")
    return <CompactBwsSummary value={value} countryRank={countryRank} />;
  return (
    <section className="bws-summary" aria-label={tr("Badge-weighted seeding")}>
      <div className="bws-metrics">
        <div>
          <h3>{tr("BW-rank")}</h3>
          {value.value !== null ? (
            <p>
              <strong className="bws-value">
                {new Intl.NumberFormat(tr.locale, {
                  maximumFractionDigits: 0,
                }).format(value.value)}
              </strong>
            </p>
          ) : (
            <p className="muted" role="status">
              {value.status === "unranked"
                ? tr("Unranked / unavailable")
                : tr("Badge eligibility pending staff review")}
            </p>
          )}
        </div>
        <div>
          <p>
            <span className="muted small">{tr("Original pp")}</span>{" "}
            <strong>
              {value.rawPp === null
                ? tr("Unavailable")
                : new Intl.NumberFormat(tr.locale, {
                    maximumFractionDigits: 2,
                    notation: value.rawPp >= 1e12 ? "scientific" : "standard",
                  }).format(value.rawPp)}
            </strong>
          </p>
        </div>
        <div>
          <h3>{tr("BW-PP")}</h3>
          {value.adjustedPp !== null ? (
            <p>
              <strong className="bws-value">
                {new Intl.NumberFormat(tr.locale, {
                  maximumFractionDigits: 2,
                  notation:
                    value.adjustedPp >= 1e12 ? "scientific" : "standard",
                }).format(value.adjustedPp)}
              </strong>
            </p>
          ) : (
            <p className="muted" role="status">
              {value.ppStatus === "pending"
                ? tr("Badge eligibility pending staff review")
                : tr("Weighted pp unavailable (missing data or numeric limit)")}
            </p>
          )}
        </div>
      </div>
      <ProfileInfo label={tr("Badge-weighted seeding")}>
        <BwsNote value={value} />
      </ProfileInfo>
    </section>
  );
}
