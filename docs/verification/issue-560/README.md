# #560 — Round referee policy management

Implementation branch: `codex/560-round-referee-policy`, based on main
`f3b30253b84e760fbb978c0c724ba5253f501186`. Verification date: 2026-10-30,
Asia/Taipei. These are local checks, not deployment or organizer acceptance.

## Behavior and source

Round management can save and edit the shared round policy before any fixture
exists. The referee panel links to the selected round and continues reading the
same saved policy. Writes retain edition Admin authorization, same-origin checks,
expected revision, transactional audit and all-round history protection. No
migration or business data backfill is needed. Saved-read contract 1.6.0 adds the
optional `mappoolWorkspace.refereeRules` projection for the remote frontend.

S11 templates use the [public v1.9 rules](https://oclr.org/tournaments/s11#rules),
read on 2026-10-30: Ban 60s, Pick 90s, preparation 120s, NF and category Mods.
The organizer explicitly selected the default sequence in this chat:
Ban/Ban → Pick/Pick → Ban/Ban → alternating Picks → TB. The saved scoring
series determines the number of Picks and 5:5/6:6 TB for BO11/BO13.

The organizer confirmed that room size, start countdown and per-map replay cap
remain unset pending Admin confirmation. A per-team disconnect allowance is
not a per-map cap. Category Ban restrictions, disconnect rulings, pauses and EX
conditions remain subject to the published rules and referee review. The
template does not claim to automate those rulings. Templates are unsaved drafts;
other seasons and existing saved policies are preserved.

## Local evidence

Checks ran with Node.js 24.22.2 (the runtime path is not part of the application).

- `npm run check`: lint and type checking passed.
- `npm test`: 155 files passed, 67 skipped; 1,215 tests passed, 572 skipped.
  Database-dependent checks were skipped without `TEST_DATABASE_URL`. This run
  preceded the three additional route tests, which passed in the affected rerun.
- Affected referee/default/read-contract/i18n rerun: 101 tests passed.
- Additional route/default/i18n rerun: 11 tests passed, including all three new
  route cases (same-origin rejection, actor/edition/round binding, 403/409).
- `npm run build`: passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- i18n extraction and tests, generated read-contract/OpenAPI/remote-matrix checks,
  Prettier and `git diff --check`: passed.
- Actual `RoundManager` browser tests: 12 passed across desktop and mobile Chrome.
  Covered unsaved S11 defaults, required room size, save payload, existing policy
  preservation, revision conflict retaining drafts, BO13 TB, read-only controls,
  all three locales, both themes and no horizontal overflow at 320px.
  Screenshots were inspected locally; generated test output is not committed.

## Remaining acceptance

Fresh isolated PostgreSQL initialization was attempted under `/private/tmp`,
including mmap configuration. Both attempts failed because the host's shared
memory IDs were exhausted (`shmget: No space left on device`, 56 bytes). No demo
or production database was used; no existing service or kernel setting changed.
The six new database cases (standalone round/save/delete, no-op audit,
authorization/concurrency, invalid pool/TB, cross-fixture active history, locked
history) await CI with PostgreSQL. Full database-backed E2E was not run.

CI, new Chinese wording review and organizer acceptance are recorded separately
on #560. No deployment, production mutation, new credential or issue closure is
claimed by this document.

## First core CI and follow-up

The [first core run](https://github.com/OCLR-dev/OCLR-website/actions/runs/41026320985)
on `c11b182b` completed with failures: 1,789 unit/integration tests passed and one
streaming test still asserted the previous `1.5.0` header. All six new round-policy
database tests passed. Build, remote smoke and E2E shard 2 passed. E2E shard 1
failed because the existing referee test read its event baseline before the
second independent order save completed.

The follow-up uses the shared contract-version constant and waits for both saved
order values before checking that preparing an IRC command appends no events.
These corrections do not change application behavior. Replacement CI results
remain separate from this failed run; a merge does not establish acceptance.
