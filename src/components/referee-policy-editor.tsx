"use client";
import { refereeMessage } from "@/i18n/referee";
import { useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import {
  refereePolicySchema,
  type RefereePolicy,
  type RefereeMap,
} from "@/lib/referee-model";
import { commandMods, type RefereeCommandPolicy } from "@/lib/referee-commands";
import { s11RefereeSteps, type RefereeDefaults } from "@/lib/referee-defaults";
import { RefereeStepEditor } from "./referee-step-editor";
import styles from "./referee-step-editor.module.css";

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
  const nextStepKey = useRef(initialPolicy?.steps.length ?? 0);
  const [steps, setSteps] = useState(() =>
    (initialPolicy?.steps ?? []).map((step, key) => ({ key, step })),
  );
  const initialBanRules = initialPolicy?.banCategoryRules;
  const [allowRepeatBan, setAllowRepeatBan] = useState(
    initialBanRules?.allowRepeats ?? true,
  );
  const [repeatExceptions, setRepeatExceptions] = useState(
    initialBanRules?.repeatExceptions ?? [],
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
    setSteps((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, step: { ...row.step, ...patch } } : row,
      ),
    );
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
      steps: steps.map((row) => row.step),
      commands,
      ...(initialBanRules || !allowRepeatBan
        ? {
            banCategoryRules: {
              allowRepeats: allowRepeatBan,
              repeatExceptions,
            },
          }
        : {}),
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
                  const generated = event.target.value
                    ? s11RefereeSteps(
                        defaults.wins,
                        event.target.value as "split" | "opening",
                      )
                    : [];
                  setSteps(
                    generated.map((step) => ({
                      key: nextStepKey.current++,
                      step,
                    })),
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
          <p className="muted small">
            {tr(
              "Ban steps allow every non-TB map by default. Open step limits only when this round needs an exception.",
            )}
          </p>
          <fieldset className="form-stack">
            <legend>{tr("Repeated Mod Bans")}</legend>
            <label>
              <input
                type="checkbox"
                checked={allowRepeatBan}
                onChange={(event) => setAllowRepeatBan(event.target.checked)}
              />{" "}
              {tr("Allow each team to Ban the same Mod more than once")}
            </label>
            {!allowRepeatBan && (
              <fieldset>
                <legend>
                  {tr("Allow repeated Bans for these categories")}
                </legend>
                <div className={styles.choices}>
                  {(["NM", "HD", "HR", "DT", "FM"] as const).map((category) => (
                    <button
                      key={category}
                      type="button"
                      className="secondary"
                      aria-pressed={repeatExceptions.includes(category)}
                      onClick={() =>
                        setRepeatExceptions((previous) =>
                          previous.includes(category)
                            ? previous.filter((value) => value !== category)
                            : [...previous, category],
                        )
                      }
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </fieldset>
          <ol
            className={styles.list}
            aria-label={tr("Finite Ban / Pick sequence")}
          >
            {steps.map(({ key, step }, index) => (
              <RefereeStepEditor
                key={key}
                step={step}
                index={index}
                count={steps.length}
                categories={categories}
                maps={maps}
                defaultTiedAt={(defaults?.wins ?? 1) - 1}
                onChange={(patch) => update(index, patch)}
                onMove={(direction) =>
                  setSteps((previous) => {
                    const next = [...previous];
                    [next[index], next[index + direction]] = [
                      next[index + direction],
                      next[index],
                    ];
                    return next;
                  })
                }
                onRemove={() =>
                  setSteps((previous) =>
                    previous.filter((_, position) => position !== index),
                  )
                }
              />
            ))}
          </ol>
          <button
            type="button"
            className="secondary"
            disabled={steps.length >= 200}
            onClick={() =>
              setSteps((s) => [
                ...s,
                {
                  key: nextStepKey.current++,
                  step: {
                    kind: "ban",
                    actor: "firstBan",
                    categories: [],
                    entryIds: [],
                    avoidRepeatCategory: false,
                    tiedAt: null,
                  },
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
