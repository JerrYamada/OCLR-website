import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicMappools } from "@/lib/mappools";
import { EmptyState, PageHeading } from "@/components/ui";
import { MappoolBrowser } from "@/components/mappool-browser";
import { MappoolStages } from "@/components/mappool-stages";
import { MappoolRounds } from "@/components/mappool-rounds";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Published mappools") };
}
export default async function MappoolsPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();
  const { edition } = await params;
  const pools = await publicMappools(edition);
  const stages = (["group", "knockout"] as const).flatMap((stage) => {
    const released = pools.filter((pool) => pool.stage === stage);
    if (!released.length) return [];
    const rounds = [...new Set(released.map((pool) => pool.roundId))];
    const label = tr(stage === "group" ? "Group Stage" : "Knockout Stage");
    return [
      {
        value: stage,
        label,
        content: (
          <MappoolRounds
            rounds={rounds.map((roundId) => {
              const round = released.filter((pool) => pool.roundId === roundId);
              return {
                value: roundId,
                label: round[0].roundName,
                content: (
                  <section
                    key={roundId}
                    className="mappool-round-group"
                    aria-label={round[0].roundName}
                  >
                    {round.length > 1 && <h3>{round[0].roundName}</h3>}
                    {round.map((pool) => {
                      // Preserve distinct authored names; flatten only redundant context.
                      const names = [
                        ...new Set([
                          ...(pools.length === 1 ? [label] : []),
                          ...(round.length === 1 ? [pool.roundName] : []),
                          pool.name,
                        ]),
                      ];
                      return (
                        <article
                          className="mappool-release"
                          key={pool.id}
                          aria-labelledby={`pool-${pool.id}-name`}
                        >
                          <header className="mappool-release-heading">
                            <h3 id={`pool-${pool.id}-name`}>
                              <Link
                                href={`/tournaments/${edition}/mappools/${pool.id}`}
                                className="context-link"
                              >
                                {names.join(" · ")}
                              </Link>
                            </h3>
                            <p className="muted small">
                              {tr("Released")} ·{" "}
                              <time dateTime={pool.publishedAt!.toISOString()}>
                                {new Intl.DateTimeFormat(tr.locale, {
                                  timeZone: "UTC",
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }).format(pool.publishedAt!)}
                              </time>{" "}
                              {tr("(UTC)")}
                            </p>
                          </header>
                          <MappoolBrowser
                            slug={edition}
                            pool={pool}
                            headingLevel={4}
                          />
                        </article>
                      );
                    })}
                  </section>
                ),
              };
            })}
          />
        ),
      },
    ];
  });
  return (
    <>
      <PageHeading title={tr("Mappools")} />
      {stages.length ? (
        <MappoolStages stages={stages} hideSingleHeading={pools.length === 1} />
      ) : (
        <EmptyState title={tr("No mappools published")}>
          {tr("Organizers will release the approved maps here.")}
        </EmptyState>
      )}
    </>
  );
}
