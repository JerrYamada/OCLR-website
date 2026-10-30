# Team configuration batch #543–#546

Implemented on `codex/543-546-team-configuration`, based on main `dfaa23ce`.
No deployment, real role grant, production-data write or credential issuance.

## Behavior

- #543: fixture editor labels are Red Team / Blue Team (红队／蓝队,
  紅隊／藍隊). Stored home/away fields and score mapping remain unchanged.
- #544: General settings controls coaching. New editions store disabled;
  absent S11 settings also mean disabled, following the organizer's explicit
  confirmation. Other existing editions retain enabled behavior. Disabled
  configuration is hidden and server-side add/remove commands are rejected,
  while saved coach assignments and their publication remain intact.
  Coach forms use content height, a bounded input/action row, mobile stacking,
  operation-specific pending labels and success/error feedback.
- #545: stage group configuration lives in Team management. The fixture
  configuration links there. Groups retain stable IDs, stage scope, versioned
  saves and separate publication. Unassigned teams are listed explicitly;
  duplicate membership is prevented in the form and rejected by the server.
- #546: authorized managers can save active unpublished team choices in private
  fixtures and private groups. Public fixture/group publication and result
  reporting still require official finalized, published teams. Referees do not
  gain the manager's private team choice collection.

The shared read schemas, OpenAPI and route coverage are regenerated; saved-read
contract 1.5.0 records these additions. The blank-draft retirement allowlist
accepts the new default-disabled setting and continues to protect configured
content. A tablet-width staff header spacing correction keeps account actions
inside the viewport.

## Verification environment

Node 24.22.2; npm ci with the existing lockfile. Dedicated loopback database
`oclr_543_546_test`, explicitly migrated, with synthetic fixtures only.
A new PostgreSQL process could not start because the host's shared-memory ID
quota was exhausted, so this separate database used the existing local test
cluster. Existing preview and production databases/processes were untouched.
The operator backup test additionally requires explicit `sslmode=disable` for
this loopback database and PostgreSQL tools on PATH.

## Verification record

- Full lint/type check passed; production build passed.
- Full initial Vitest: 1,750 passed, 14 failed, one skipped (217 files).
  Failures were the superseded unpublished-team rejection, blank-draft setting
  allowlist, stale generated contracts/OpenAPI, and operator backup connection
  configuration. The eight affected service/contract files then produced
  90 passed and one backup environment failure; the backup test passed with
  explicit local connection configuration. The same backup environment failure
  was reproduced on unmodified main before correcting the test invocation.
- Edition configuration unit checks: 17 passed, including S11/default overrides.
- i18n checks: four passed; formal dependency audit: zero vulnerabilities.
- Related desktop/mobile Playwright slice: 18 passed, two new cases failed on
  an exact label locator. After correcting the locator, those two cases both
  passed. Thus all 20 related cases have passing evidence, covering fixtures,
  source completion, coach publication, group configuration, settings and the
  combined new workflow. This is focused coverage, not the full-site browser
  matrix. Initial findings (old labels/status locators, synthetic cleanup,
  minimum group membership and tablet header overflow) were corrected.
- Reviewed final desktop/mobile screenshots in this directory. Disabled coaching
  leaves no configuration placeholder; enabled forms stack on mobile. Group
  editing, unpublished markers and light/dark rendering are visible.
- `git diff --check` passed. Commit-specific CI is reported on the PR/issues;
  local results are not a CI or deployment claim.

## Organizer review and CI follow-up — 2026-10-30

The organizer explicitly approved the new Chinese interface wording and
authorized CI repairs, automatic PR/merge, and closure of #543–#546 after
acceptance. This replaces the earlier pending wording review.

The operator integration fixture now supplies `sslmode=disable` when the isolated
test connection omits an explicit mode, matching the synthetic CI PostgreSQL
service. Caller-supplied modes are retained. Production operator validation and
runtime configuration are unchanged. Using the same mode-omitting test URL that
previously left the backup queued, the backup integration and authorization,
locking and package checks all passed: four files, six tests. Focused ESLint and
`git diff --check` passed. No production build or browser rerun is needed for
this test-only connection setup change.

Exact CI results and closure evidence are recorded on the four issues. Pending,
skipped and full-regression coverage remain distinct from passing core checks.
No production deployment or real credentials/data operation was performed.
