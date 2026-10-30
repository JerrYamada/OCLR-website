import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  fixtures,
  mappoolEvents,
  mappools,
  refereeSessions,
  tournamentRounds,
} from "../../src/db/schema";
import {
  refereeCommand,
  refereeWorkspace,
  type RefereeWorkspace,
} from "../../src/lib/referee";
import { saveRoundRefereePolicy } from "../../src/lib/round-referee-policy";
import { mappoolCommand, mappoolWorkspace } from "../../src/lib/mappools";
import {
  seedRefereeFixture,
  refereeTestAdmin as admin,
  refereeTestUser as referee,
  syntheticRefereePolicy as policy,
} from "../fixtures/referee";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("round referee policies independent of fixtures", () => {
  let w: RefereeWorkspace;
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    w = (await seedRefereeFixture(false)).workspace;
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  const save = (expectedRevision = 0, changes = {}) =>
    saveRoundRefereePolicy(admin, "test-cup", w.round.id, {
      expectedRevision,
      policy: { ...policy, ...changes },
    });
  it("saves before any fixture exists without creating a referee session", async () => {
    const [original] = await db()
      .select()
      .from(tournamentRounds)
      .where(eq(tournamentRounds.id, w.round.id));
    const [round] = await db()
      .insert(tournamentRounds)
      .values({
        ...original,
        id: randomUUID(),
        position: 99,
        name: "Synthetic standalone round",
      })
      .returning();
    expect(
      await saveRoundRefereePolicy(admin, "test-cup", round.id, {
        expectedRevision: 0,
        policy,
      }),
    ).toMatchObject({ revision: 1, policy });
    expect(await db().select().from(refereeSessions)).toHaveLength(0);
    const read = await mappoolWorkspace(admin, "test-cup");
    expect(
      read.refereeRules?.find((rule) => rule.roundId === round.id),
    ).toMatchObject({ revision: 1, policy });
    await mappoolCommand(admin, "test-cup", {
      action: "round_delete",
      roundId: round.id,
      expectedVersion: round.version,
      confirmed: true,
    });
    expect(
      await db()
        .select()
        .from(tournamentRounds)
        .where(eq(tournamentRounds.id, round.id)),
    ).toHaveLength(0);
  });
  it("shares saved round policy with the referee panel and preserves no-op writes", async () => {
    await save();
    await save(1);
    const read = await refereeWorkspace(referee, "test-cup", w.fixture.id);
    expect(read.policy).toEqual(policy);
    expect(read.session).toBeNull();
    const audits = await db()
      .select()
      .from(mappoolEvents)
      .where(eq(mappoolEvents.action, "round_referee_policy"));
    expect(audits).toHaveLength(1);
  });
  it("persists repeat Ban controls and rejects TB as a repeat exception", async () => {
    await save(0, {
      banCategoryRules: { allowRepeats: false, repeatExceptions: ["NM", "FM"] },
    });
    expect(
      (await refereeWorkspace(referee, "test-cup", w.fixture.id)).policy
        ?.banCategoryRules,
    ).toEqual({ allowRepeats: false, repeatExceptions: ["NM", "FM"] });
    await save(1, {
      banCategoryRules: { allowRepeats: true, repeatExceptions: [] },
    });
    await expect(
      save(2, {
        banCategoryRules: { allowRepeats: false, repeatExceptions: ["TB"] },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await refereeWorkspace(referee, "test-cup", w.fixture.id))
        .policyRevision,
    ).toBe(2);
  });
  it("rejects referee, wrong edition and stale revisions", async () => {
    await expect(
      saveRoundRefereePolicy(referee, "test-cup", w.round.id, {
        expectedRevision: 0,
        policy,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      saveRoundRefereePolicy(admin, "another-cup", w.round.id, {
        expectedRevision: 0,
        policy,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await save();
    await expect(save(0)).rejects.toMatchObject({ status: 409 });
    const results = await Promise.allSettled([
      save(1, { maxReplaysPerMap: 1 }),
      save(1, { maxReplaysPerMap: 2 }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
  });
  it("rejects foreign pool entries and an incompatible tiebreak", async () => {
    const invalid = structuredClone(policy);
    invalid.steps[0].entryIds = [randomUUID()];
    await expect(
      saveRoundRefereePolicy(admin, "test-cup", w.round.id, {
        expectedRevision: 0,
        policy: invalid,
      }),
    ).rejects.toMatchObject({ status: 400 });
    invalid.steps[0].entryIds = [];
    invalid.steps.at(-1)!.tiedAt = 5;
    await expect(
      saveRoundRefereePolicy(admin, "test-cup", w.round.id, {
        expectedRevision: 0,
        policy: invalid,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("protects active steps in another fixture even through the legacy panel command", async () => {
    await save();
    w = await refereeWorkspace(admin, "test-cup", w.fixture.id);
    const command = async (action: Record<string, unknown>) => {
      w = (
        await refereeCommand(admin, "test-cup", w.fixture.id, {
          ...action,
          requestKey: randomUUID(),
          expectedRevision: w.session?.revision ?? 0,
          dependencyFingerprint: w.dependencyFingerprint,
        })
      ).workspace;
    };
    await command({
      action: "set_order",
      firstBanTeamId: w.teams[0].id,
      firstPickTeamId: w.teams[0].id,
    });
    await command({
      action: "record_selection",
      entryId: w.maps.find((map) => map.category === "NM")!.id,
    });
    await expect(save(1, { maxReplaysPerMap: 1 })).rejects.toMatchObject({
      status: 409,
    });
    const [original] = await db()
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, w.fixture.id));
    const [other] = await db()
      .insert(fixtures)
      .values({
        ...original,
        id: randomUUID(),
        position: 99,
        label: "Other fixture",
      })
      .returning();
    const otherWorkspace = await refereeWorkspace(admin, "test-cup", other.id);
    await expect(
      refereeCommand(admin, "test-cup", other.id, {
        action: "configure_policy",
        expectedPolicyRevision: 1,
        policy: { ...policy, maxReplaysPerMap: 1 },
        requestKey: randomUUID(),
        expectedRevision: 0,
        dependencyFingerprint: otherWorkspace.dependencyFingerprint,
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await refereeWorkspace(admin, "test-cup", w.fixture.id)).events,
    ).toEqual(w.events);
  });
  it("protects completed-fixture pool history", async () => {
    await save();
    const [fixture] = await db()
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, w.fixture.id));
    await db()
      .update(mappools)
      .set({ lockedAt: new Date() })
      .where(eq(mappools.id, fixture.mappoolId!));
    await expect(save(1, { maxReplaysPerMap: 1 })).rejects.toMatchObject({
      status: 409,
    });
  });
});
