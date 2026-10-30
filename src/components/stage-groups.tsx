"use client";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { FixtureWorkspace } from "@/lib/fixtures";
import { ReadOnlyFields } from "./staff-read-only";
import { ConfirmMutation } from "./confirm-mutation";
export function StageGroups({
  slug,
  data,
  stage,
}: {
  slug: string;
  data: Pick<FixtureWorkspace, "teams">;
  stage: FixtureWorkspace["stages"][number];
}) {
  const tr = useAppTranslations();

  const [groups, setGroups] = useState<
    { key?: string; name: string; teamIds: string[] }[]
  >(stage.groupConfiguration?.groups ?? []);
  const [published, setPublished] = useState(Boolean(stage.groupsPublishedAt));
  return (
    <ReadOnlyFields>
      <section className="form-stack team-group-manager">
        <h3>{tr("Approved Group Stage assignments")}</h3>
        <p className="muted">
          {tr(
            "Configure the actual groups and team membership. Unpublished assignments never appear in standings. Each team may belong to one group in this stage.",
          )}
        </p>
        <p className="small muted">
          {tr("Unassigned teams")}:{" "}
          {data.teams
            .filter((t) => !groups.some((g) => g.teamIds.includes(t.id)))
            .map((t) => t.name)
            .join(", ") || tr("None")}
        </p>
        {groups.map((group, index) => (
          <fieldset key={index}>
            <legend>
              {tr("Group ")}
              {index + 1}
            </legend>
            <label className="field">
              <span>
                {tr("Group name ")}
                {index + 1}
              </span>
              <input
                value={group.name}
                maxLength={80}
                onChange={(e) =>
                  setGroups((old) =>
                    old.map((g, i) =>
                      i === index ? { ...g, name: e.target.value } : g,
                    ),
                  )
                }
              />
            </label>
            <div className="team-group-options">
              {data.teams.map((t) => (
                <label className="checkbox-row" key={t.id}>
                  <input
                    type="checkbox"
                    checked={group.teamIds.includes(t.id)}
                    disabled={
                      !group.teamIds.includes(t.id) &&
                      groups.some(
                        (g, i) => i !== index && g.teamIds.includes(t.id),
                      )
                    }
                    onChange={(e) =>
                      setGroups((old) =>
                        old.map((g, i) =>
                          i === index
                            ? {
                                ...g,
                                teamIds: e.target.checked
                                  ? [...g.teamIds, t.id]
                                  : g.teamIds.filter((id) => id !== t.id),
                              }
                            : g,
                        ),
                      )
                    }
                  />
                  <span>
                    {t.name}
                    {t.unpublished ? ` · ${tr("Unpublished")}` : ""}
                  </span>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                setGroups((old) => old.filter((_, i) => i !== index))
              }
            >
              {tr("Remove group ")}
              {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setGroups((old) => [...old, { name: "", teamIds: [] }])
          }
        >
          {tr("Add group")}
        </button>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>{tr("Publish approved group assignments")}</span>
        </label>
        <ConfirmMutation
          label={tr("Save group assignments")}
          title={tr("Save approved Group Stage configuration?")}
          description={tr(
            "This updates the group membership used by public standings when published. Scores remain governed by reviewed results and the configured round ranking rules.",
          )}
          url={`/api/admin/tournaments/${slug}/matches`}
          payload={{
            action: "stage_groups",
            stageId: stage.id,
            expectedVersion: stage.version,
            configuration: groups.length ? { groups } : null,
            published,
            confirmed: true,
          }}
        />
      </section>
    </ReadOnlyFields>
  );
}
