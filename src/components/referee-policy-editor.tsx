"use client";
import { refereeMessage } from "@/i18n/referee";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import {
  refereePolicySchema,
  type RefereePolicy,
  type RefereeMap,
} from "@/lib/referee-model";
import { commandMods, type RefereeCommandPolicy } from "@/lib/referee-commands";
import { s11RefereeSteps, type RefereeDefaults } from "@/lib/referee-defaults";

export function RefereePolicyEditor({
  policy,
  defaults,
  maps,
  busy,
  onSave,
}: {
  policy: RefereePolicy | null;
  defaults?: RefereeDefaults | null;
  maps: RefereeMap[];
  busy: boolean;
  onSave: (policy: RefereePolicy) => Promise<void>;
}) {
  const tr = useAppTranslations();
  const initialPolicy = policy ?? defaults?.policy;
  const initialCommands = policy ? policy.commands : defaults?.commands;
  const [placement, setPlacement] = useState(
    defaults && !policy ? "split" : "",
  );
  const [steps, setSteps] = useState<RefereePolicy["steps"]>(
    initialPolicy?.steps ?? [],
  );
  const [roomSize, setRoomSize] = useState(
    policy?.commands?.roomSize.toString() ?? "",
  );
  const [noFail, setNoFail] = useState(initialCommands?.noFail ?? false);
  const [durations, setDurations] = useState({
    banSeconds: initialCommands?.banSeconds?.toString() ?? "",
    pickSeconds: initialCommands?.pickSeconds?.toString() ?? "",
    prepareSeconds: initialCommands?.prepareSeconds?.toString() ?? "",
    startSeconds: initialCommands?.startSeconds?.toString() ?? "",
  });
  const [mods, setMods] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initialCommands?.categoryMods ?? {}).map(([k, v]) => [
        k,
        v.mods.join(" "),
      ]),
    ),
  );
  const [free, setFree] = useState<Record<string, boolean>>(
    Object.fromEntries(
      Object.entries(initialCommands?.categoryMods ?? {}).map(([k, v]) => [
        k,
        v.freemod,
      ]),
    ),
  );
  const [maxReplays, setMaxReplays] = useState(
    policy?.maxReplaysPerMap?.toString() ?? "",
  );
  const [error, setError] = useState("");
  const categories = Array.from(
    new Set([
      ...Object.keys(initialCommands?.categoryMods ?? {}),
      ...maps.map((m) => m.category),
    ]),
  );
  function update(
    index: number,
    patch: Partial<RefereePolicy["steps"][number]>,
  ) {
    setSteps((s) => s.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const commands: RefereeCommandPolicy | null = roomSize
      ? {
          roomSize: Number(roomSize),
          noFail,
          categoryMods: Object.fromEntries(
            categories.map((c) => [
              c,
              {
                mods: (mods[c] ?? "")
                  .trim()
                  .split(/\s+/)
                  .filter(Boolean) as (typeof commandMods)[number][],
                freemod: free[c] ?? false,
              },
            ]),
          ),
          ...(Object.fromEntries(
            Object.entries(durations).map(([k, v]) => [
              k,
              v ? Number(v) : null,
            ]),
          ) as Pick<
            RefereeCommandPolicy,
            "banSeconds" | "pickSeconds" | "prepareSeconds" | "startSeconds"
          >),
        }
      : null;
    const parsed = refereePolicySchema.safeParse({
      steps,
      commands,
      ...(maxReplays === "" ? {} : { maxReplaysPerMap: Number(maxReplays) }),
    });
    if (!parsed.success) {
      setError(
        tr("Review the step order, tiebreak conditions and command settings."),
      );
      return;
    }
    await onSave(parsed.data);
  }
  return (
    <details className="panel">
      <summary>{tr("Configure round referee policy")}</summary>
      <form className="form-stack" onSubmit={submit}>
        <p className="muted">
          {tr(
            "These settings apply to every fixture in this round. Changes take effect only after saving; existing referee records remain protected.",
          )}
        </p>
        <fieldset disabled={busy} className="staff-readonly-fields form-stack">
          <label className="field">
            {tr("Maximum replays per map")}
            <input
              type="number"
              min={0}
              max={20}
              step={1}
              value={maxReplays}
              onChange={(e) => setMaxReplays(e.target.value)}
            />
          </label>
          <h3>{tr("Finite Ban / Pick sequence")}</h3>
          {!policy && defaults && (
            <label className="field">
              <span>{tr("Confirm the placement of the second Ban")}</span>
              <select
                value={placement}
                required
                onChange={(event) => {
                  setPlacement(event.target.value);
                  setSteps(
                    event.target.value
                      ? s11RefereeSteps(
                          defaults.wins,
                          event.target.value as "split" | "opening",
                        )
                      : [],
                  );
                }}
              >
                <option value="">{tr("Not set")}</option>
                <option value="split">
                  {tr("Second Ban after each team's first Pick")}
                </option>
                <option value="opening">
                  {tr("Both Bans before any Pick")}
                </option>
              </select>
            </label>
          )}
          {steps.map((step, index) => (
            <div className="panel form-stack" key={index}>
              <strong>{tr("Step {number}", { number: index + 1 })}</strong>
              <label className="field">
                <span>{tr("Action")}</span>
                <select
                  value={step.kind}
                  onChange={(e) => {
                    const kind = e.target.value as typeof step.kind;
                    update(index, {
                      kind,
                      actor:
                        kind === "ban"
                          ? "firstBan"
                          : kind === "tb"
                            ? "neutral"
                            : "firstPick",
                      tiedAt: kind === "tb" ? 0 : null,
                    });
                  }}
                >
                  <option value="ban">{tr("Ban")}</option>
                  <option value="pick">{tr("Pick")}</option>
                  <option value="tb">TB</option>
                </select>
              </label>
              <label className="field">
                <span>{tr("Acting order")}</span>
                <select
                  value={step.actor}
                  onChange={(e) =>
                    update(index, {
                      actor: e.target.value as typeof step.actor,
                    })
                  }
                >
                  {(step.kind === "ban"
                    ? ["firstBan", "secondBan"]
                    : step.kind === "tb"
                      ? ["firstPick", "secondPick", "neutral"]
                      : ["firstPick", "secondPick"]
                  ).map((v) => (
                    <option key={v} value={v}>
                      {refereeMessage(tr, v)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{tr("Allowed categories (empty allows all)")}</span>
                <select
                  multiple
                  value={step.categories}
                  onChange={(e) =>
                    update(index, {
                      categories: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{tr("Allowed pool entries (optional)")}</span>
                <select
                  multiple
                  value={step.entryIds}
                  onChange={(e) =>
                    update(index, {
                      entryIds: Array.from(
                        e.target.selectedOptions,
                        (o) => o.value,
                      ),
                    })
                  }
                >
                  {maps.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.category}
                      {m.position} · {m.beatmapId}
                    </option>
                  ))}
                </select>
              </label>
              {step.kind === "tb" && (
                <label className="field">
                  <span>{tr("Both teams must have this score before TB")}</span>
                  <input
                    type="number"
                    min={0}
                    max={98}
                    required
                    value={step.tiedAt ?? ""}
                    onChange={(e) =>
                      update(index, {
                        tiedAt:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
              )}
              {step.kind !== "ban" && (
                <label>
                  <input
                    type="checkbox"
                    checked={step.avoidRepeatCategory}
                    onChange={(e) =>
                      update(index, { avoidRepeatCategory: e.target.checked })
                    }
                  />{" "}
                  {tr("This team cannot repeat a picked category")}
                </label>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={index === 0}
                  onClick={() =>
                    setSteps((s) => {
                      const a = [...s];
                      [a[index - 1], a[index]] = [a[index], a[index - 1]];
                      return a;
                    })
                  }
                >
                  {tr("Move up")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setSteps((s) => s.filter((_, i) => i !== index))
                  }
                >
                  {tr("Remove step")}
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={steps.length >= 200}
            onClick={() =>
              setSteps((s) => [
                ...s,
                {
                  kind: "ban",
                  actor: "firstBan",
                  categories: [],
                  entryIds: [],
                  avoidRepeatCategory: false,
                  tiedAt: null,
                },
              ])
            }
          >
            {tr("Add step")}
          </button>
          <h3>{tr("Round command settings")}</h3>
          <label className="field">
            <span>{tr("Room size (separate from players per team)")}</span>
            <input
              type="number"
              min={1}
              max={16}
              required={Boolean(defaults && !policy)}
              value={roomSize}
              onChange={(e) => setRoomSize(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={noFail}
              onChange={(e) => setNoFail(e.target.checked)}
            />{" "}
            {tr("Require No Fail for every map")}
          </label>
          {(
            [
              "banSeconds",
              "pickSeconds",
              "prepareSeconds",
              "startSeconds",
            ] as const
          ).map((key) => (
            <label className="field" key={key}>
              <span>{refereeMessage(tr, key)}</span>
              <input
                type="number"
                min={1}
                value={durations[key]}
                onChange={(e) =>
                  setDurations((d) => ({ ...d, [key]: e.target.value }))
                }
              />
            </label>
          ))}
          {categories.map((category) => (
            <div className="form-stack" key={category}>
              <label className="field">
                <span>
                  {tr(
                    "Mods for {category} (space separated; empty clears Mods)",
                    { category },
                  )}
                </span>
                <input
                  value={mods[category] ?? ""}
                  onChange={(e) =>
                    setMods((m) => ({
                      ...m,
                      [category]: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="HD"
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={free[category] ?? false}
                  onChange={(e) =>
                    setFree((f) => ({ ...f, [category]: e.target.checked }))
                  }
                />{" "}
                {category} · {tr("Freemod")}
              </label>
            </div>
          ))}
          <button type="submit">{tr("Save round referee policy")}</button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </details>
  );
}
