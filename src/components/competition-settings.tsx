"use client";
import { useState } from "react";
import Link from "next/link";
import { useAppTranslations } from "@/i18n/shared";
import type { FixtureWorkspace } from "@/lib/fixtures";
import {
  ReadOnlyFields,
  StaffReadOnlyContext,
  useStaffReadOnly,
} from "./staff-read-only";
import { ConfirmMutation } from "./confirm-mutation";
import { InfoNote } from "./info-note";
import styles from "./competition-settings.module.css";
type Round = FixtureWorkspace["rounds"][number];
function RoundRules({ slug, entry }: { slug: string; entry: Round }) {
  const tr = useAppTranslations();

  const { round, stage } = entry;
  const rules = round.scoringRules;
  const standings = round.standingsRules;
  const [teamType, setTeamType] = useState(rules?.teamType ?? "");
  const [drawPoints, setDrawPoints] = useState(
    String(standings?.drawPoints ?? ""),
  );
  const [failure, setFailure] = useState(rules?.failedScorePolicy ?? "");
  const [mapTies, setMapTies] = useState(rules?.tiedMapPolicy ?? "");
  const [shortHanded, setShortHanded] = useState(
    rules ? String(rules.allowShortHanded ?? "") : "",
  );
  const enabled = true;
  const [mode, setMode] = useState<string>(rules?.mode ?? "");
  const [scoreType, setScoreType] = useState<string>(rules?.scoringType ?? "");
  const [aggregation, setAggregation] = useState<string>(
    rules?.aggregation ?? "",
  );
  const [players, setPlayers] = useState(String(rules?.playersPerTeam ?? ""));
  const [series, setSeries] = useState<string>(rules?.series.type ?? "");
  const [maps, setMaps] = useState(
    String(
      rules?.series.type === "first_to"
        ? rules.series.wins
        : (rules?.series.count ?? ""),
    ),
  );
  const [draws, setDraws] = useState(
    rules?.series.type === "fixed_maps" ? String(rules.series.allowDraw) : "",
  );
  const [subs, setSubs] = useState(
    rules ? String(rules.allowSubstitutions) : "",
  );
  const ranked = true;
  const [winPoints, setWinPoints] = useState(
    String(standings?.winPoints ?? ""),
  );
  const [lossPoints, setLossPoints] = useState(
    String(standings?.lossPoints ?? ""),
  );
  const [tiebreakers, setTiebreakers] = useState(
    standings?.tiebreakers.join(", ") ?? "",
  );
  return (
    <ReadOnlyFields>
      <div className="form-stack">
        <p className="notice small">
          {tr(
            "Only save organizer-approved rules. Unconfigured scoring cannot produce an official result; unconfigured standings cannot produce a ranking.",
          )}
        </p>
        <div className={styles.columns}>
          {enabled && (
            <section className="form-stack">
              <h4>{tr("Configure approved scoring rules")}</h4>
              <label className="field">
                <span>{tr("Game mode")}</span>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  {["osu", "taiko", "fruits", "mania"].map((m) => (
                    <option value={m} key={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <InfoNote>
                <p className="small muted">
                  {tr(
                    "Automatic scoring supports configured roster aggregation with Score or Score v2. Other provider modes require review and cannot silently produce winners.",
                  )}
                </p>
              </InfoNote>
              <label className="field">
                <span>{tr("Multiplayer team mode")}</span>
                <select
                  value={teamType}
                  onChange={(e) => setTeamType(e.target.value)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="team-vs">{tr("Team vs")}</option>
                  <option value="head-to-head">
                    {tr("Head-to-head with explicit roster aggregation")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Scoring type")}</span>
                <select
                  value={scoreType}
                  onChange={(e) =>
                    setScoreType(e.target.value as typeof scoreType)
                  }
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="score">{tr("Score")}</option>
                  <option value="scorev2">{tr("Score v2")}</option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Team score aggregation")}</span>
                <select
                  value={aggregation}
                  onChange={(e) =>
                    setAggregation(e.target.value as typeof aggregation)
                  }
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="sum">{tr("Sum")}</option>
                  <option value="average">{tr("Average")}</option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Players per team per game")}</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={players}
                  onChange={(e) => setPlayers(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{tr("Series format")}</span>
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value as typeof series)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="first_to">
                    {tr("First to a configured number of map wins")}
                  </option>
                  <option value="fixed_maps">
                    {tr("Fixed number of maps")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>
                  {series === "first_to"
                    ? tr("Map wins required")
                    : tr("Maps to play")}
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={maps}
                  onChange={(e) => setMaps(e.target.value)}
                />
              </label>
              {series === "fixed_maps" && (
                <label className="field">
                  <span>{tr("Tied series policy")}</span>
                  <select
                    value={draws}
                    onChange={(e) => setDraws(e.target.value)}
                  >
                    <option value="">{tr("Unconfirmed")}</option>
                    <option value="true">{tr("Draw permitted")}</option>
                    <option value="false">{tr("Draw not permitted")}</option>
                  </select>
                </label>
              )}
              <label className="field">
                <span>{tr("Failed player scores")}</span>
                <select
                  value={failure}
                  onChange={(e) => setFailure(e.target.value)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="include">
                    {tr("Count the recorded score")}
                  </option>
                  <option value="zero">
                    {tr("Count failed scores as zero")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Tied map policy")}</span>
                <select
                  value={mapTies}
                  onChange={(e) => setMapTies(e.target.value)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="require_replay">
                    {tr("Require replay; exclude the tied original")}
                  </option>
                  <option value="count_as_draw">
                    {tr("Count as a drawn map, without a map win")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Understrength teams")}</span>
                <select
                  value={shortHanded}
                  onChange={(e) => setShortHanded(e.target.value)}
                >
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="false">
                    {tr("Require the configured player count")}
                  </option>
                  <option value="true">
                    {tr("Allow fewer players with explicit review")}
                  </option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Substitution policy")}</span>
                <select value={subs} onChange={(e) => setSubs(e.target.value)}>
                  <option value="">{tr("Unconfirmed")}</option>
                  <option value="true">
                    {tr("Allow explicitly reviewed substitutions")}
                  </option>
                  <option value="false">{tr("No substitutions")}</option>
                </select>
              </label>
            </section>
          )}
          {stage === "group" && (
            <section className="form-stack">
              <h4>{tr("Configure approved group ranking rules")}</h4>
              {ranked && (
                <>
                  <label className="field">
                    <span>{tr("Points for a win")}</span>
                    <input
                      type="number"
                      value={winPoints}
                      onChange={(e) => setWinPoints(e.target.value)}
                      min={-100}
                      max={100}
                    />
                  </label>
                  <label className="field">
                    <span>{tr("Points for a loss")}</span>
                    <input
                      type="number"
                      value={lossPoints}
                      onChange={(e) => setLossPoints(e.target.value)}
                      min={-100}
                      max={100}
                    />
                  </label>
                  <label className="field">
                    <span>
                      {tr("Points for a draw (leave blank if unconfirmed)")}
                    </span>
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      value={drawPoints}
                      onChange={(e) => setDrawPoints(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>{tr("Ranking criteria, in order")}</span>
                    <input
                      value={tiebreakers}
                      onChange={(e) => setTiebreakers(e.target.value)}
                      maxLength={100}
                      placeholder={tr("Approved criteria only")}
                    />
                  </label>
                  <InfoNote>
                    <p className="small muted">
                      {tr(
                        "Supported explicit criteria: points, wins, map_difference, maps_won. Separate by commas. Unresolved ties remain tied.",
                      )}
                    </p>
                  </InfoNote>
                </>
              )}
            </section>
          )}
        </div>
        <ConfirmMutation
          label={tr("Save approved round rules")}
          title={tr("Confirm competition rules?")}
          description={tr(
            "Save the explicitly configured rules for {value0}. This does not publish any imported score.",
            { value0: round.name },
          )}
          url={`/api/admin/tournaments/${slug}/matches`}
          payload={{
            action: "round_rules",
            roundId: round.id,
            expectedVersion: round.version,
            scoringRules: enabled
              ? {
                  mode,
                  teamType,
                  scoringType: scoreType,
                  aggregation,
                  playersPerTeam: Number(players),
                  series: !series
                    ? null
                    : series === "first_to"
                      ? { type: "first_to", wins: Number(maps) }
                      : {
                          type: "fixed_maps",
                          count: Number(maps),
                          allowDraw: draws === "" ? null : draws === "true",
                        },
                  allowSubstitutions: subs === "" ? null : subs === "true",
                  allowShortHanded:
                    shortHanded === "" ? null : shortHanded === "true",
                  failedScorePolicy: failure,
                  tiedMapPolicy: mapTies,
                }
              : null,
            standingsRules:
              stage === "group" && ranked
                ? {
                    winPoints: winPoints.trim() ? Number(winPoints) : null,
                    lossPoints: lossPoints.trim() ? Number(lossPoints) : null,
                    drawPoints: drawPoints.trim() ? Number(drawPoints) : null,
                    tiebreakers: tiebreakers.split(",").map((v) => v.trim()),
                  }
                : null,
            confirmed: true,
          }}
        />
      </div>
    </ReadOnlyFields>
  );
}
export function CompetitionSettings({
  slug,
  data,
}: {
  slug: string;
  data: FixtureWorkspace;
}) {
  const tr = useAppTranslations();
  const readOnly = useStaffReadOnly();
  return (
    <section
      id="competition"
      className={styles.settings}
      aria-label={tr("Competition configuration")}
    >
      <h2>{tr("Competition configuration")}</h2>
      <Link
        className="text-link"
        href={`/admin/tournaments/${slug}/teams#groups`}
      >
        {tr("Configure groups in team management")}
      </Link>
      {data.rounds.map((entry) => (
        <section className={styles.round} key={entry.round.id}>
          <h3>
            {entry.round.name}
            {tr(": approved competition rules")}
          </h3>
          <StaffReadOnlyContext value={readOnly || !data.canManage}>
            <RoundRules
              key={`${entry.round.id}-${entry.round.version}`}
              slug={slug}
              entry={entry}
            />
          </StaffReadOnlyContext>
        </section>
      ))}
    </section>
  );
}
