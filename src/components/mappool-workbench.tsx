"use client";
import { useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type {
  CandidateComments,
  CandidatePreview,
  SelectionWorkspace,
} from "@/lib/mappool-workbench";
import type { BeatmapMetadata } from "@/lib/mappool-model";
import {
  beatmapModeNames,
  formatBeatmapDuration,
  formatBeatmapNumber,
} from "@/lib/mappool-model";
import {
  candidateLimit,
  commentLength,
  commentLimit,
} from "@/lib/mappool-workbench-model";
import { BeatmapCover } from "./beatmap-cover";
import styles from "./mappool-workbench.module.css";
async function request<T>(url: string, data?: unknown): Promise<T> {
  const response = await fetch(
    url,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : { cache: "no-store" },
  ).catch(() => null);
  if (!response)
    throw new Error("This request could not be completed. Please try again.");
  const result = await response.json().catch(() => null);
  if (!result)
    throw new Error("This request could not be completed. Please try again.");
  if (!response.ok)
    throw new Error(
      result.error || "This request could not be completed. Please try again.",
    );
  return result as T;
}
function Stamp({ value }: { value: string | Date }) {
  const tr = useAppTranslations();
  const date = new Date(value);
  return (
    <time dateTime={date.toISOString()}>
      {new Intl.DateTimeFormat(tr.locale, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date)}{" "}
      UTC
    </time>
  );
}
function MapIdentity({
  id,
  metadata: m,
}: {
  id: number;
  metadata: BeatmapMetadata;
}) {
  const tr = useAppTranslations();
  return (
    <div className={styles.identity}>
      <BeatmapCover setId={m.setId} compact />
      <div>
        <a
          className="text-link"
          href={`https://osu.ppy.sh/beatmaps/${id}`}
          target="_blank"
          rel="noreferrer"
        >
          <strong>
            {m.artist} — {m.title}
          </strong>{" "}
          ↗
        </a>
        <p className="small muted">
          {m.difficulty} · {m.mapper}
        </p>
        <span className="small muted">
          {tr("BID")} {id}
        </span>
      </div>
    </div>
  );
}
function Parameters({ m }: { m: BeatmapMetadata }) {
  const tr = useAppTranslations();
  const statuses: Record<string, string> = {
    graveyard: tr("Graveyard"),
    wip: tr("Work in progress"),
    pending: tr("Pending"),
    ranked: tr("Ranked"),
    approved: tr("Approved"),
    qualified: tr("Qualified"),
    loved: tr("Loved"),
  };
  return (
    <div className={styles.parameters}>
      <p>
        <strong>
          {formatBeatmapNumber(m.stars, 2)} {tr("★ base")}
        </strong>
        <span>
          {formatBeatmapNumber(m.bpm)} {tr("BPM")}
        </span>
        <span>{formatBeatmapDuration(m.duration)}</span>
      </p>
      <p className="muted small">
        <span>
          {tr("AR")} {formatBeatmapNumber(m.ar)}
        </span>
        <span>
          {tr("OD")} {formatBeatmapNumber(m.od)}
        </span>
        <span>
          {tr("CS")} {formatBeatmapNumber(m.cs)}
        </span>
        <span>
          {tr("HP")} {formatBeatmapNumber(m.hp)}
        </span>
      </p>
      <p className="muted small">
        {m.mode ? tr(beatmapModeNames[m.mode]) : tr("Unknown")} ·{" "}
        {m.status ? (statuses[m.status] ?? tr("Unknown")) : tr("Unknown")}
      </p>
    </div>
  );
}
function Comments({
  slug,
  id,
  count,
  writable,
  onChange,
}: {
  slug: string;
  id: string;
  count: number;
  writable: boolean;
  onChange: () => Promise<void>;
}) {
  const tr = useAppTranslations();
  const [comments, setComments] = useState<CandidateComments | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const submission = useRef<{ body: string; id: string } | null>(null);
  const base = `/api/admin/tournaments/${slug}/mappool-workbench`;
  const load = async () =>
    setComments(await request<CandidateComments>(`${base}/${id}/comments`));
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <details
      className={styles.discussion}
      onToggle={(event) => {
        if (event.currentTarget.open && comments === null) void refresh();
      }}
    >
      <summary>
        {tr("Comments ({count})", { count: comments?.length ?? count })}
      </summary>
      <div className={styles.thread}>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {tr("Refresh comments")}
        </button>
        {comments?.length === 0 && (
          <p className="muted small">{tr("No comments yet.")}</p>
        )}
        <ol className={styles.comments}>
          {comments?.map((c) => (
            <li key={c.id}>
              <p className="small">
                <strong>{c.authorName}</strong>{" "}
                <span className="muted">
                  · <Stamp value={c.createdAt} />
                </span>
              </p>
              <p className={styles.commentBody}>{c.body}</p>
            </li>
          ))}
        </ol>
        {writable && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              if (
                !submission.current ||
                submission.current.body !== body.trim()
              )
                submission.current = {
                  body: body.trim(),
                  id: crypto.randomUUID(),
                };
              try {
                await request(base, {
                  action: "comment",
                  candidateId: id,
                  requestId: submission.current.id,
                  body: submission.current.body,
                });
                setBody("");
                submission.current = null;
                await load();
                await onChange();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>{tr("Your comment")}</span>
              <textarea
                value={body}
                disabled={busy}
                onChange={(event) => setBody(event.target.value)}
                required
                maxLength={commentLength}
                rows={3}
              />
            </label>
            <p className="small muted">
              {tr(
                "Up to {count} characters per comment; {limit} comments per map.",
                { count: commentLength, limit: commentLimit },
              )}
            </p>
            <button disabled={busy || !body.trim()}>
              {busy ? tr("Working…") : tr("Post comment")}
            </button>
          </form>
        )}
        {busy && <p role="status">{tr("Working…")}</p>}
        {error && (
          <p className="error" role="alert">
            {tr(error)}
          </p>
        )}
      </div>
    </details>
  );
}
export function SelectionWorkbench({
  slug,
  initialData,
  writable,
}: {
  slug: string;
  initialData: SelectionWorkspace;
  writable: boolean;
}) {
  const tr = useAppTranslations();
  const [data, setData] = useState(initialData);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<CandidatePreview | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const base = `/api/admin/tournaments/${slug}/mappool-workbench`;
  const reload = async () => setData(await request<SelectionWorkspace>(base));
  const states: Record<string, string> = {
    ready: tr("Ready"),
    duplicate: tr("Duplicate"),
    invalid: tr("Invalid BID"),
    failed: tr("Lookup failed"),
  };
  return (
    <div className={styles.workbench}>
      <p className="muted">
        {tr(
          "Collect candidate maps and discuss test feedback. Candidates and comments remain private to authorized staff.",
        )}
      </p>
      {!writable && (
        <p className="notice">
          {data.archived
            ? tr(
                "Historical archives are read-only in the selection workbench.",
              )
            : tr("This workbench is read-only.")}
        </p>
      )}
      {writable && (
        <section
          className={styles.importer}
          aria-labelledby="candidate-import-heading"
        >
          <h2 id="candidate-import-heading">{tr("Add candidate maps")}</h2>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              setError("");
              setNotice("");
              setPreview(null);
              try {
                const result = await request<CandidatePreview>(base, {
                  action: "preview",
                  text,
                });
                setPreview(result);
                setSelected(
                  result.rows
                    .filter((r) => r.status === "ready")
                    .map((r) => r.line),
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            <label className="field">
              <span>{tr("Beatmap IDs or difficulty URLs")}</span>
              <textarea
                rows={4}
                required
                maxLength={16000}
                value={text}
                disabled={busy}
                onChange={(e) => {
                  setText(e.target.value);
                  setPreview(null);
                }}
                placeholder={"4184799\nhttps://osu.ppy.sh/beatmaps/75"}
                aria-describedby="candidate-input-help"
              />
            </label>
            <p className="small muted" id="candidate-input-help">
              {tr(
                "One BID or official difficulty URL per line, up to 50 maps. Blank lines are ignored; set-only URLs are not supported.",
              )}
            </p>
            <button disabled={busy || !text.trim()}>
              {tr("Preview candidates")}
            </button>
          </form>
          {preview && (
            <div className={styles.preview}>
              <h3>{tr("Candidate preview")}</h3>
              <ul className={styles.previewList}>
                {preview.rows.map((r) => (
                  <li key={r.line}>
                    <label className={styles.choice}>
                      <input
                        type="checkbox"
                        aria-label={tr("Include row {count}", {
                          count: r.line,
                        })}
                        checked={selected.includes(r.line)}
                        disabled={busy || r.status !== "ready"}
                        onChange={(e) =>
                          setSelected((old) =>
                            e.target.checked
                              ? [...old, r.line]
                              : old.filter((n) => n !== r.line),
                          )
                        }
                      />
                      <span className="small">
                        {tr("Row {count}", { count: r.line })} ·{" "}
                        {states[r.status]} · {r.input}
                      </span>
                    </label>
                    {r.snapshot && (
                      <div className={styles.previewMap}>
                        <MapIdentity
                          id={r.snapshot.beatmapId}
                          metadata={r.snapshot.metadata}
                        />
                        <Parameters m={r.snapshot.metadata} />
                      </div>
                    )}
                    {r.error && <p className="small error">{tr(r.error)}</p>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy || !selected.length}
                onClick={async () => {
                  if (pending.current) return;
                  pending.current = true;
                  setBusy(true);
                  setError("");
                  const chosen = preview.rows.filter(
                    (r) =>
                      selected.includes(r.line) &&
                      r.status === "ready" &&
                      r.snapshot,
                  );
                  try {
                    const result = await request<{
                      added: number;
                      skipped: number;
                    }>(base, {
                      action: "add",
                      rows: chosen.map((r) => ({
                        beatmapId: r.beatmapId,
                        fingerprint: r.snapshot!.fingerprint,
                      })),
                    });
                    setNotice(
                      tr(
                        "Added {count} maps; skipped {skipped} existing maps.",
                        { count: result.added, skipped: result.skipped },
                      ),
                    );
                    const done = new Set(chosen.map((r) => r.line));
                    setText(
                      preview.rows
                        .filter(
                          (r) => !done.has(r.line) && r.status !== "duplicate",
                        )
                        .map((r) => r.input)
                        .join("\n"),
                    );
                    setPreview(null);
                    setSelected([]);
                    await reload();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    pending.current = false;
                    setBusy(false);
                  }
                }}
              >
                {tr("Add selected candidates ({count})", {
                  count: selected.length,
                })}
              </button>
            </div>
          )}
        </section>
      )}
      {busy && <p role="status">{tr("Working…")}</p>}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p className="error" role="alert">
          {tr(error)}
        </p>
      )}
      <section aria-labelledby="candidate-list-heading">
        <div className={styles.listHeading}>
          <h2 id="candidate-list-heading">
            {tr("Candidate maps ({count})", { count: data.candidates.length })}
          </h2>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {tr("Refresh list")}
          </button>
        </div>
        <p className="small muted">
          {tr(
            "Up to {count} candidates per edition. Adding candidates does not change or publish an official pool.",
            { count: candidateLimit },
          )}
        </p>
        {!data.candidates.length && (
          <p className="empty">{tr("No candidate maps yet.")}</p>
        )}
        <ul className={styles.candidates}>
          {data.candidates.map((c) => (
            <li key={c.id}>
              <article aria-label={`BID ${c.beatmapId}`}>
                <div className={styles.mapRow}>
                  <MapIdentity id={c.beatmapId} metadata={c.metadata} />
                  <Parameters m={c.metadata} />
                  <div className="small muted">
                    <p>
                      {tr("Added by")} <strong>{c.authorName}</strong>
                    </p>
                    <Stamp value={c.createdAt} />
                    <details className={styles.snapshot}>
                      <summary>{tr("Metadata snapshot")}</summary>
                      <p>{tr("Official osu! API")}</p>
                      <Stamp value={c.metadataFetchedAt} />
                      <p>
                        {new Date(data.asOf).getTime() -
                          new Date(c.metadataFetchedAt).getTime() >
                        86400000
                          ? tr("Saved snapshot older than 24 hours.")
                          : tr("Saved snapshot; not a live lookup.")}
                      </p>
                    </details>
                  </div>
                </div>
                <Comments
                  slug={slug}
                  id={c.id}
                  count={c.commentCount}
                  writable={writable}
                  onChange={reload}
                />
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
