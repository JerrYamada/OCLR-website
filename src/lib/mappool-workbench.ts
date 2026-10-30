import { db } from "@/db";
import {
  editionState,
  mappoolCandidates,
  mappoolCandidateComments,
  mappoolEvents,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { User } from "./auth/sessions";
import { assertCapability, assertReadCapability } from "./auth/staff";
import { assertOperationalEdition } from "./archive-guard";
import { getEdition } from "./content";
import { remoteMode } from "./data-source";
import { assertRemoteSubject, frontendResource } from "./frontend-resource";
import { HttpError } from "./http";
import { fetchBeatmaps } from "./osu-beatmaps";
import type { BeatmapSnapshot } from "./mappool-model";
import {
  candidateCategories,
  candidateLimit,
  commentLimit,
  commentLength,
  parseCandidateRows,
} from "./mappool-workbench-model";

async function databaseSelectionWorkspace(actor: User, slug: string) {
  await assertReadCapability(actor, "select_mappools", slug);
  const edition = await getEdition(slug);
  if (!edition) throw new HttpError(404, "Edition not found.");
  const candidates = await db()
    .select({
      id: mappoolCandidates.id,
      beatmapId: mappoolCandidates.beatmapId,
      category: mappoolCandidates.category,
      metadata: mappoolCandidates.metadata,
      metadataFetchedAt: mappoolCandidates.metadataFetchedAt,
      authorId: mappoolCandidates.authorId,
      authorName: mappoolCandidates.authorName,
      createdAt: mappoolCandidates.createdAt,
      commentCount: sql<number>`count(${mappoolCandidateComments.id})::int`,
    })
    .from(mappoolCandidates)
    .leftJoin(
      mappoolCandidateComments,
      eq(mappoolCandidateComments.candidateId, mappoolCandidates.id),
    )
    .where(eq(mappoolCandidates.editionSlug, slug))
    .groupBy(mappoolCandidates.id)
    .orderBy(mappoolCandidates.createdAt, mappoolCandidates.id)
    .limit(candidateLimit);
  return { candidates, asOf: new Date(), archived: Boolean(edition.archive) };
}
export async function selectionWorkspace(
  actor: User,
  slug: string,
): Promise<Awaited<ReturnType<typeof databaseSelectionWorkspace>>> {
  if (remoteMode()) {
    await assertRemoteSubject(actor.osuId);
    return frontendResource("selectionWorkspace", { slug });
  }
  return databaseSelectionWorkspace(actor, slug);
}
export type SelectionWorkspace = Awaited<ReturnType<typeof selectionWorkspace>>;
async function databaseCandidateComments(
  actor: User,
  slug: string,
  id: string,
) {
  await assertReadCapability(actor, "select_mappools", slug);
  if (!z.uuid().safeParse(id).success)
    throw new HttpError(400, "Invalid candidate.");
  const [candidate] = await db()
    .select({ id: mappoolCandidates.id })
    .from(mappoolCandidates)
    .where(
      and(
        eq(mappoolCandidates.id, id),
        eq(mappoolCandidates.editionSlug, slug),
      ),
    );
  if (!candidate) throw new HttpError(404, "Candidate not found.");
  return db()
    .select({
      id: mappoolCandidateComments.id,
      authorId: mappoolCandidateComments.authorId,
      authorName: mappoolCandidateComments.authorName,
      body: mappoolCandidateComments.body,
      createdAt: mappoolCandidateComments.createdAt,
    })
    .from(mappoolCandidateComments)
    .where(eq(mappoolCandidateComments.candidateId, id))
    .orderBy(mappoolCandidateComments.createdAt, mappoolCandidateComments.id)
    .limit(commentLimit);
}
export async function candidateComments(
  actor: User,
  slug: string,
  id: string,
): Promise<Awaited<ReturnType<typeof databaseCandidateComments>>> {
  if (remoteMode()) {
    await assertRemoteSubject(actor.osuId);
    return frontendResource("candidateComments", { slug, id });
  }
  return databaseCandidateComments(actor, slug, id);
}
export type CandidateComments = Awaited<ReturnType<typeof candidateComments>>;
export async function previewCandidates(
  actor: User,
  slug: string,
  input: unknown,
) {
  // Preview spends provider budget, so it requires the same live write grant.
  await assertCapability(actor, "select_mappools", slug);
  const parsed = z
    .object({
      text: z.string().max(16000),
      category: z.enum(candidateCategories).default("unassigned"),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Enter between 1 and 50 map rows.");
  const data = await selectionWorkspace(actor, slug);
  if (data.archived)
    throw new HttpError(
      409,
      "Historical archives are read-only in the selection workbench.",
    );
  let rows;
  try {
    rows = parseCandidateRows(
      parsed.data.text,
      data.candidates
        .filter((c) => c.category === parsed.data.category)
        .map((c) => c.beatmapId),
    );
  } catch {
    throw new HttpError(400, "Enter between 1 and 50 map rows.");
  }
  const ids = rows.filter((r) => r.status === "ready").map((r) => r.beatmapId!);
  const snapshots = ids.length
    ? await fetchBeatmaps(ids)
    : new Map<number, BeatmapSnapshot | HttpError>();
  return {
    rows: rows.map((r) => {
      const result = snapshots.get(r.beatmapId!);
      return {
        ...r,
        status:
          r.status === "ready" && (!result || result instanceof HttpError)
            ? "failed"
            : r.status,
        snapshot: result && !(result instanceof HttpError) ? result : null,
        error: result instanceof HttpError ? result.message : null,
      };
    }),
  };
}
export type CandidatePreview = Awaited<ReturnType<typeof previewCandidates>>;
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("classify"),
      candidateId: z.uuid(),
      category: z.enum(candidateCategories),
      expectedCategory: z.enum(candidateCategories),
    })
    .strict(),
  z
    .object({
      action: z.literal("add"),
      category: z.enum(candidateCategories).default("unassigned"),
      rows: z
        .array(
          z
            .object({
              beatmapId: z
                .number()
                .int()
                .positive()
                .max(Number.MAX_SAFE_INTEGER),
              fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
            })
            .strict(),
        )
        .min(1)
        .max(50)
        .refine(
          (rows) => new Set(rows.map((r) => r.beatmapId)).size === rows.length,
        ),
    })
    .strict(),
  z
    .object({
      action: z.literal("comment"),
      candidateId: z.uuid(),
      requestId: z.uuid(),
      body: z.string().trim().min(1).max(commentLength),
    })
    .strict(),
]);
export async function selectionCommand(
  actor: User,
  slug: string,
  input: unknown,
) {
  await assertCapability(actor, "select_mappools", slug);
  if (!(await getEdition(slug))) throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Enter a valid selection workbench change.");
  const c = parsed.data;
  const snapshots = new Map<number, BeatmapSnapshot>();
  if (c.action === "add") {
    const existing = await db()
      .select({
        id: mappoolCandidates.beatmapId,
        category: mappoolCandidates.category,
      })
      .from(mappoolCandidates)
      .where(eq(mappoolCandidates.editionSlug, slug));
    const known = new Set(
      existing.filter((r) => r.category === c.category).map((r) => r.id),
    );
    const ids = c.rows
      .filter((r) => !known.has(r.beatmapId))
      .map((r) => r.beatmapId);
    if (ids.length) {
      const results = await fetchBeatmaps(ids);
      for (const row of c.rows.filter((r) => !known.has(r.beatmapId))) {
        const snapshot = results.get(row.beatmapId);
        if (!snapshot || snapshot instanceof HttpError)
          throw snapshot ?? new HttpError(502, "Beatmap lookup failed.");
        if (snapshot.fingerprint !== row.fingerprint)
          throw new HttpError(
            409,
            "Official metadata changed. Preview the batch again.",
          );
        snapshots.set(row.beatmapId, snapshot);
      }
    }
  }
  return db().transaction(async (tx) => {
    // Shared edition lock serializes candidate deduplication and comment retries.
    await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    await assertCapability(actor, "select_mappools", slug, tx);
    await assertOperationalEdition(slug, tx);
    if (c.action === "add") {
      const existing = await tx
        .select({
          id: mappoolCandidates.beatmapId,
          category: mappoolCandidates.category,
        })
        .from(mappoolCandidates)
        .where(eq(mappoolCandidates.editionSlug, slug));
      const known = new Set(
        existing.filter((r) => r.category === c.category).map((r) => r.id),
      );
      const pending = c.rows.filter((r) => !known.has(r.beatmapId));
      if (existing.length + pending.length > candidateLimit)
        throw new HttpError(
          409,
          "This workbench has reached its candidate limit.",
        );
      const added: number[] = [];
      for (const row of pending) {
        const snapshot = snapshots.get(row.beatmapId);
        // A previously known candidate may have moved while provider work ran.
        if (!snapshot)
          throw new HttpError(
            409,
            "Candidate category changed. Refresh the list.",
          );
        const [candidate] = await tx
          .insert(mappoolCandidates)
          .values({
            editionSlug: slug,
            beatmapId: row.beatmapId,
            category: c.category,
            metadata: snapshot.metadata,
            metadataFetchedAt: new Date(snapshot.fetchedAt),
            authorId: actor.osuId,
            authorName: actor.username,
          })
          .returning({ id: mappoolCandidates.id });
        await tx.insert(mappoolEvents).values({
          editionSlug: slug,
          actorId: actor.osuId,
          action: "candidate_add",
          after: {
            candidateId: candidate.id,
            beatmapId: row.beatmapId,
            category: c.category,
          },
        });
        added.push(row.beatmapId);
      }
      return { added: added.length, skipped: c.rows.length - added.length };
    }
    const [candidate] = await tx
      .select()
      .from(mappoolCandidates)
      .where(
        and(
          eq(mappoolCandidates.id, c.candidateId),
          eq(mappoolCandidates.editionSlug, slug),
        ),
      );
    if (!candidate) throw new HttpError(404, "Candidate not found.");
    if (c.action === "classify") {
      if (candidate.category === c.category) return { added: 0, skipped: 1 };
      if (candidate.category !== c.expectedCategory)
        throw new HttpError(
          409,
          "Candidate category changed. Refresh the list.",
        );
      const [duplicate] = await tx
        .select({ id: mappoolCandidates.id })
        .from(mappoolCandidates)
        .where(
          and(
            eq(mappoolCandidates.editionSlug, slug),
            eq(mappoolCandidates.category, c.category),
            eq(mappoolCandidates.beatmapId, candidate.beatmapId),
          ),
        );
      if (duplicate)
        throw new HttpError(
          409,
          "This map already exists in that Mod category.",
        );
      await tx
        .update(mappoolCandidates)
        .set({ category: c.category })
        .where(eq(mappoolCandidates.id, candidate.id));
      await tx.insert(mappoolEvents).values({
        editionSlug: slug,
        actorId: actor.osuId,
        action: "candidate_classify",
        before: { candidateId: candidate.id, category: candidate.category },
        after: { candidateId: candidate.id, category: c.category },
      });
      return { added: 0, skipped: 0 };
    }
    const [prior] = await tx
      .select()
      .from(mappoolCandidateComments)
      .where(
        and(
          eq(mappoolCandidateComments.candidateId, c.candidateId),
          eq(mappoolCandidateComments.authorId, actor.osuId),
          eq(mappoolCandidateComments.requestId, c.requestId),
        ),
      );
    if (prior) {
      if (prior.candidateId !== c.candidateId || prior.body !== c.body)
        throw new HttpError(
          409,
          "This comment request was already used. Reload the comments.",
        );
      return { added: 0, skipped: 1 };
    }
    const [count] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(mappoolCandidateComments)
      .where(eq(mappoolCandidateComments.candidateId, candidate.id));
    if (count.value >= commentLimit)
      throw new HttpError(409, "This candidate has reached its comment limit.");
    const [comment] = await tx
      .insert(mappoolCandidateComments)
      .values({
        candidateId: candidate.id,
        editionSlug: slug,
        requestId: c.requestId,
        body: c.body,
        authorId: actor.osuId,
        authorName: actor.username,
      })
      .returning({ id: mappoolCandidateComments.id });
    await tx.insert(mappoolEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      action: "candidate_comment",
      after: { candidateId: candidate.id, commentId: comment.id },
    });
    return { added: 1, skipped: 0 };
  });
}
