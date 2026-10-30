import { useAppTranslations } from "@/i18n/shared";
import { BwsSummary } from "./bws-summary";
import { RankChart } from "./rank-chart";
import type { BwsSummary as BwsData } from "@/lib/bws-model";
import Image from "next/image";
import type { ReactNode } from "react";
import type { ProfileSnapshot } from "@/lib/osu-profile-model";
export function PlayerProfile({
  snapshot,
  bws,
  heading,
}: {
  snapshot: ProfileSnapshot;
  bws?: BwsData | null;
  heading?: ReactNode;
}) {
  const tr = useAppTranslations();
  const number = (v: number | null, decimals = 0) =>
    v === null
      ? tr("Unavailable")
      : new Intl.NumberFormat(tr.locale, {
          maximumFractionDigits: decimals,
        }).format(v);
  const score = (v: string | null) =>
    v === null ? tr("Unavailable") : BigInt(v).toLocaleString(tr.locale);
  const playTime = (seconds: number | null) => {
    if (seconds === null) return tr("Unavailable");
    const total = Math.floor(seconds);
    // Compact units keep long play times on one row.
    const parts: [number, string][] = [
      [Math.floor(total / 86400), tr("d")],
      [Math.floor(total / 3600) % 24, tr("h")],
      [Math.floor(total / 60) % 60, tr("m")],
      [total % 60, tr("s")],
    ];
    return parts
      .filter(([value], index) => value > 0 || (total === 0 && index === 3))
      .map(
        ([value, unit]) =>
          `${new Intl.NumberFormat(tr.locale).format(value)}${unit}`,
      )
      .join(" ");
  };

  const p = snapshot.profile;
  const s = p.statistics;
  const history = p.rankHistory?.data ?? null;
  return (
    <section
      className="panel profile-summary"
      aria-label={tr("{value0} profile snapshot", {
        value0: "osu!",
      })}
    >
      {p.coverUrl ? (
        <div className="profile-cover">
          <Image
            className="profile-cover-image"
            src={p.coverUrl}
            alt=""
            width={1200}
            height={300}
            unoptimized
          />
          {(heading || bws) && (
            <div className="profile-cover-content">
              {heading}
              {bws && (
                <BwsSummary
                  value={bws}
                  variant="compact"
                  countryRank={s.countryRank}
                />
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {heading}
          {bws && (
            <BwsSummary
              value={bws}
              variant="compact"
              countryRank={s.countryRank}
            />
          )}
        </>
      )}
      <div
        className={
          history && history.length > 1
            ? "profile-body"
            : "profile-body profile-body--single"
        }
      >
        {history && history.length > 1 && (
          <div className="rank-chart-card">
            <RankChart data={history} globalRank={s.globalRank} />
          </div>
        )}
        <dl className="profile-statistics">
          {[
            [
              "Accuracy",
              s.accuracy === null
                ? tr("Unavailable")
                : `${number(s.accuracy, 2)}%`,
            ],
            ["Play count", number(s.playCount)],
            ["Play time", playTime(s.playTimeSeconds)],
            ["Ranked score", score(s.rankedScore)],
            ["Total score", score(s.totalScore)],
            [
              "Maximum combo",
              s.maximumCombo === null
                ? tr("Unavailable")
                : `${number(s.maximumCombo)}×`,
            ],
            [
              "Level",
              s.level?.current === null || s.level?.current === undefined
                ? tr("Unavailable")
                : `${number(s.level.current)}${s.level.progress !== null ? ` (${number(s.level.progress)}%)` : ""}`,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{tr(label)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {s.grades && (
        <p className="muted small">
          {tr("Grades:")}{" "}
          {Object.entries(s.grades)
            .map(([grade, count]) => `${grade.toUpperCase()} ${number(count)}`)
            .join(" · ")}
        </p>
      )}
      <dl className="profile-details muted small">
        <div>
          <dt>{tr("Joined")}</dt>
          <dd>{p.joinedAt ?? tr("Unavailable")}</dd>
        </div>
        <div>
          <dt>{tr("Last seen")}</dt>
          <dd>{p.lastSeenAt ?? tr("Not public / unavailable")}</dd>
        </div>
        <div>
          <dt>{tr("Active account")}</dt>
          <dd>
            {p.active === null
              ? tr("Unavailable")
              : p.active
                ? tr("Yes")
                : tr("No")}
          </dd>
        </div>
        <div>
          <dt>{tr("Bot account")}</dt>
          <dd>
            {p.bot === null ? tr("Unavailable") : p.bot ? tr("Yes") : tr("No")}
          </dd>
        </div>
        {p.previousUsernames.length > 0 && (
          <div className="profile-previous-names">
            <dt>{tr("Previous usernames")}</dt>
            <dd>{p.previousUsernames.join(", ")}</dd>
          </div>
        )}
      </dl>
      <footer className="profile-summary-footer">
        {tr("Last updated")} <time dateTime={p.fetchedAt}>{p.fetchedAt}</time>
      </footer>
    </section>
  );
}
