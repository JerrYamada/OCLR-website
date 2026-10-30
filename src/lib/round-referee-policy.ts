import { db } from "@/db";
import {
  editionState,
  fixtures,
  mappoolEntries,
  mappoolEvents,
  mappools,
  refereeEvents,
  refereeRoundPolicies,
  refereeSessions,
  resultRevisions,
  tournamentRounds,
} from "@/db/schema";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { isDeepStrictEqual } from "node:util";
import { assertOperationalEdition } from "./archive-guard";
import type { User } from "./auth/sessions";
import { assertCapability } from "./auth/staff";
import type { ScoringRules } from "./competition-model";
import { HttpError } from "./http";
import {
  projectReferee,
  refereePolicySchema,
  type RefereePolicy,
  type RefereeEvent,
} from "./referee-model";

export type RoundRefereeRule = {
  roundId: string;
  revision: number;
  policy: RefereePolicy | null;
  series: ScoringRules["series"] | null;
};
type Transaction = Parameters<
  Parameters<ReturnType<typeof db>["transaction"]>[0]
>[0];
export const roundRefereePolicyCommandSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    policy: refereePolicySchema,
  })
  .strict();

/** Caller holds the referee advisory lock, then the edition lock. */
export async function persistRoundRefereePolicy(
  tx: Transaction,
  actor: User,
  slug: string,
  roundId: string,
  expectedRevision: number,
  policy: RefereePolicy,
) {
  await assertCapability(actor, "manage_fixtures", slug, tx);
  await assertOperationalEdition(slug, tx);
  const [round] = await tx
    .select()
    .from(tournamentRounds)
    .where(
      and(
        eq(tournamentRounds.id, roundId),
        eq(tournamentRounds.editionSlug, slug),
      ),
    )
    .for("update");
  if (!round) throw new HttpError(404, "Round not found.");
  const [before] = await tx
    .select()
    .from(refereeRoundPolicies)
    .where(eq(refereeRoundPolicies.roundId, roundId));
  if ((before?.revision ?? 0) !== expectedRevision)
    throw new HttpError(
      409,
      "The round referee policy changed. Refresh before saving.",
    );
  if (before && isDeepStrictEqual(before.policy, policy))
    return before.revision;
  const pools = await tx
    .select()
    .from(mappools)
    .where(and(eq(mappools.roundId, roundId), eq(mappools.editionSlug, slug)));
  if (pools.some((p) => p.lockedAt))
    throw new HttpError(
      409,
      "Completed-fixture referee policies are protected; create a new round instead.",
    );
  const completed = await tx
    .select({ id: fixtures.id })
    .from(fixtures)
    .innerJoin(resultRevisions, eq(resultRevisions.fixtureId, fixtures.id))
    .where(
      and(
        eq(fixtures.roundId, roundId),
        eq(fixtures.editionSlug, slug),
        isNotNull(resultRevisions.approvedAt),
      ),
    )
    .limit(1);
  if (completed.length)
    throw new HttpError(
      409,
      "Completed-fixture referee policies are protected; create a new round instead.",
    );
  const entries = pools.length
    ? await tx
        .select({ id: mappoolEntries.id })
        .from(mappoolEntries)
        .where(
          inArray(
            mappoolEntries.poolId,
            pools.map((p) => p.id),
          ),
        )
    : [];
  if (
    policy.steps.some((step) =>
      step.entryIds.some((id) => !entries.some((entry) => entry.id === id)),
    )
  )
    throw new HttpError(
      400,
      "Referee policy entries must belong to this round.",
    );
  if (
    policy.steps.some((step) =>
      step.categories.some(
        (category) => !["NM", "HD", "HR", "DT", "FM", "TB"].includes(category),
      ),
    )
  )
    throw new HttpError(
      400,
      "Choose valid pool categories for the referee policy.",
    );
  const tb = policy.steps.findIndex((step) => step.kind === "tb");
  if (tb >= 0) {
    const tiedAt = policy.steps[tb].tiedAt!;
    if (
      policy.steps.slice(0, tb).filter((step) => step.kind === "pick").length <
        tiedAt * 2 ||
      (round.scoringRules?.series.type === "first_to" &&
        tiedAt !== round.scoringRules.series.wins - 1)
    )
      throw new HttpError(
        400,
        "The tiebreak condition is incompatible with the round series.",
      );
  }
  const sessions = await tx
    .select({ session: refereeSessions })
    .from(refereeSessions)
    .innerJoin(fixtures, eq(fixtures.id, refereeSessions.fixtureId))
    .where(and(eq(fixtures.roundId, roundId), eq(fixtures.editionSlug, slug)));
  for (const { session } of sessions) {
    const rows = await tx
      .select()
      .from(refereeEvents)
      .where(eq(refereeEvents.fixtureId, session.fixtureId))
      .orderBy(refereeEvents.ordinal);
    const events: RefereeEvent[] = rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
    if (
      projectReferee({ ...session.basis, orders: session, events })
        .activeSelections.length
    )
      throw new HttpError(
        409,
        "Withdraw recorded steps before changing the referee policy.",
      );
  }
  const revision = expectedRevision + 1;
  await tx
    .insert(refereeRoundPolicies)
    .values({
      roundId,
      editionSlug: slug,
      revision,
      policy,
      updatedBy: actor.osuId,
    })
    .onConflictDoUpdate({
      target: refereeRoundPolicies.roundId,
      set: { revision, policy, updatedBy: actor.osuId, updatedAt: new Date() },
    });
  await tx.insert(mappoolEvents).values({
    editionSlug: slug,
    actorId: actor.osuId,
    action: "round_referee_policy",
    before: before ?? null,
    after: { roundId, revision, policy },
  });
  return revision;
}

export async function saveRoundRefereePolicy(
  actor: User,
  slug: string,
  roundId: string,
  input: unknown,
) {
  await assertCapability(actor, "manage_fixtures", slug);
  const command = roundRefereePolicyCommandSchema.safeParse(input);
  if (!command.success || !z.uuid().safeParse(roundId).success)
    throw new HttpError(
      400,
      "Review the step order, tiebreak conditions and command settings.",
    );
  return db().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(17301)`);
    await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    const revision = await persistRoundRefereePolicy(
      tx,
      actor,
      slug,
      roundId,
      command.data.expectedRevision,
      command.data.policy,
    );
    return { revision, policy: command.data.policy };
  });
}
