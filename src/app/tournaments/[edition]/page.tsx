import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { registrationAvailability } from "@/lib/registrations";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate, publicEditionSummary } from "@/lib/editions";
import { publicCompetition } from "@/lib/public-competition";
import { publicMappools } from "@/lib/mappools";
import { publishedTeams } from "@/lib/teams";
import { Action, Badge } from "@/components/ui";
import { MilestoneRail } from "@/components/milestone-rail";
import { EventArtwork } from "@/components/event-artwork";
import { MatchCard, GroupStandings } from "@/components/public-matches";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  return { title: (await getPublicEdition(edition))?.name ?? "Tournament" };
}
export default async function Overview({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const [state, [competitionResult, poolsResult, teamsResult]] =
    await Promise.all([
      registrationAvailability(edition),
      Promise.allSettled([
        publicCompetition(slug),
        publicMappools(slug),
        publishedTeams(slug),
      ]),
    ]);
  const competition =
    competitionResult.status === "fulfilled" ? competitionResult.value : null;
  const pools = poolsResult.status === "fulfilled" ? poolsResult.value : [];
  const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
  const fixtures = competition?.fixtures ?? [];
  const upcoming = fixtures
    .filter((f) => !f.result && f.status !== "cancelled")
    .sort((a, b) =>
      (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
    )
    .slice(0, 4);
  const latest = fixtures
    .filter((f) => f.result)
    .sort((a, b) => b.result!.updatedAt.localeCompare(a.result!.updatedAt))
    .slice(0, 4);
  const base = `/tournaments/${slug}`;
  return (
    <>
      <section
        className={`event-hero${edition.branding.keyVisual ? " has-artwork" : ""}`}
        aria-labelledby="event-title"
      >
        <div className="event-intro">
          <Badge>{tr(edition.status)}</Badge>
          <h1 id="event-title">{edition.name}</h1>
          {publicEditionSummary(edition.summary) && (
            <p className="muted">{publicEditionSummary(edition.summary)}</p>
          )}
          <div className="actions">
            <Action
              href={`${base}/${state === "open" ? "register" : "schedule"}`}
            >
              {state === "open"
                ? tr("Register individually")
                : tr("View schedule")}
            </Action>
            <Action href={`${base}/mappools`} secondary>
              {tr("Explore mappools")}
            </Action>
          </div>
        </div>
        {edition.branding.keyVisual && (
          <EventArtwork src={edition.branding.keyVisual} name={edition.name} />
        )}
      </section>
      {edition.schedule.length > 0 && (
        <MilestoneRail label={tr("Tournament milestones")}>
          {edition.schedule.map((event, i) => (
            <li key={i}>
              <span className="event-step">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{event.label}</strong>
                <p className="muted small">
                  {tr(formatDate(event.at, edition.timeZone, tr.locale))}
                </p>
              </div>
            </li>
          ))}
        </MilestoneRail>
      )}
      {[competitionResult, poolsResult, teamsResult].some(
        (r) => r.status === "rejected",
      ) && (
        <p className="notice" role="status">
          {tr(
            "Some competition information is temporarily unavailable. Please try again later.",
          )}
        </p>
      )}
      <div className="event-overview-grid">
        <div className="event-overview-main">
          {upcoming.length > 0 && (
            <section aria-labelledby="upcoming-heading">
              <div className="section-title">
                <h2 id="upcoming-heading">{tr("Coming up")}</h2>
                <Link className="context-link" href={`${base}/schedule`}>
                  {tr("Full schedule")}
                </Link>
              </div>
              <div className="overview-matches">
                {upcoming.map((f) => (
                  <MatchCard key={f.id} fixture={f} slug={slug} />
                ))}
              </div>
            </section>
          )}
          {latest.length > 0 && (
            <section aria-labelledby="latest-heading">
              <div className="section-title">
                <h2 id="latest-heading">{tr("Latest results")}</h2>
                <Link className="context-link" href={`${base}/results`}>
                  {tr("All results")}
                </Link>
              </div>
              <div className="overview-matches">
                {latest.map((f) => (
                  <MatchCard key={f.id} fixture={f} slug={slug} />
                ))}
              </div>
            </section>
          )}
          {competition?.groups.length ? (
            <GroupStandings groups={competition.groups} slug={slug} />
          ) : null}
          {pools.length > 0 && (
            <section className="panel">
              <div className="section-title">
                <h2>{tr("Released mappools")}</h2>
                <Link className="context-link" href={`${base}/mappools`}>
                  {tr("All mappools")}
                </Link>
              </div>
              <ul className="event-pool-list">
                {pools.slice(0, 4).map((pool) => (
                  <li key={pool.id}>
                    <Link href={`${base}/mappools/${pool.id}`}>
                      <span className="eyebrow">{pool.roundName}</span>
                      <strong>{pool.name}</strong>
                      <span className="muted small">
                        {pool.entries.length} {tr(" maps")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <aside
          className="event-overview-aside"
          aria-label={tr("Tournament information")}
        >
          <section className="panel">
            <div className="section-title">
              <h2>{tr("Registration")}</h2>
              <Badge>{tr(state)}</Badge>
            </div>
            <p className="muted small">
              {tr("Individual entry. Captain-led team draft.")}
            </p>
            <dl className="detail-list">
              <div>
                <dt>{tr("Opens")}</dt>
                <dd>
                  {tr(
                    formatDate(
                      edition.registration?.opensAt ?? null,
                      edition.timeZone,
                      tr.locale,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt>{tr("Closes")}</dt>
                <dd>
                  {tr(
                    formatDate(
                      edition.registration?.closesAt ?? null,
                      edition.timeZone,
                      tr.locale,
                    ),
                  )}
                </dd>
              </div>
              <div>
                <dt>{tr("Time zone")}</dt>
                <dd>{edition.timeZone}</dd>
              </div>
            </dl>
            {edition.rules && (
              <p className="spaced">
                <Link href={`${base}/rules`} className="context-link">
                  {tr("Read the rules")}
                </Link>
              </p>
            )}
          </section>
          {edition.eligibility && (
            <section className="panel">
              <h2>{tr("Eligibility")}</h2>
              <p className="muted preserve-lines">{edition.eligibility}</p>
            </section>
          )}
          {teams.length > 0 && (
            <section className="panel">
              <div className="section-title">
                <h2>{tr("Teams")}</h2>
                <Badge>{teams.length}</Badge>
              </div>
              <ul className="event-team-links">
                {teams.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <Link
                      className="context-link"
                      href={`${base}/teams/${t.id}`}
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link className="context-link" href={`${base}/teams`}>
                {tr("Explore teams")}
              </Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
