# #571 — Admin force deletion of unapproved test fixtures

Date: 2026-10-30 (Asia/Taipei). Branch:
`codex/571-force-test-fixture-delete`, based on `88b5f38a`.

The organizer explicitly selected removal of test fixtures and unapproved
records while keeping official results and bracket references protected.
This work implements that flow; it does not delete the fixture in the screenshot.

## Scope and safety

- Separate Admin action with a consistent deletion preview, exact fixture-label
  confirmation and test-data acknowledgement. An execution snapshot fingerprint,
  fixture version and assignment revision prevent stale confirmations. Pure
  heartbeat metadata is excluded from the fingerprint.
- Approved/published state, any prior approval/publication audit, approved
  revisions, official game claims, downstream fixture references and published
  statistics block force deletion. Ordinary deletion retains its old guards.
- One transaction archives fixture-owned execution/source evidence and preserves
  original audit identity, actors and dates before removing the dependent graph.
  Shared pools/teams/round policies and desktop credential/session tables are not
  deleted. No migration or automatic cleanup is introduced.
- Referee advisory → edition → fixture locks serialize application writers.
  Same-origin checks, current edition Admin capability and exact-payload tombstone
  replay remain mandatory. Stale callbacks cannot recreate deleted rows. The
  website cannot recall commands already sent to IRC.
- Admin preflight uses the existing local POST channel and is not exposed as a
  new Developer saved-read resource. Developer/remote business writes stay denied.

## Local evidence

Node.js 24.22.2, npm and the existing lockfile.

- `npm ci --ignore-scripts`, `npm run check`, `npm run build`: completed.
- Full available test run: 1,252 passed, 584 skipped and one generated-contract
  synchronization failure. The drift came from the upstream #570 profile DTO
  changes. Generated read contracts/OpenAPI were refreshed; the affected
  contract/API/protection/i18n rerun passed all 20 tests. No application profile
  behavior was changed for this synchronization.
- Actual browser component suite: 14 passed across desktop/mobile Chrome,
  including three locales, light/dark, 320px, exact acknowledgement, cancellation,
  official-history and read-only blockers, stale preview invalidation and a
  lost-response retry using the same deletion snapshot. The network-error message
  was corrected after the initial lost-response cases exposed raw browser text.
- i18n extraction/checks, generator checks, formatting/diff checks passed.
  Formal dependency audit found 0 vulnerabilities.

A fresh PostgreSQL cluster under `/private/tmp` failed during initialization:
the host exhausted shared-memory IDs (`shmget`, 56 bytes). No existing demo or
production database, service or kernel setting was changed. Database-backed
deletion and full-site E2E were not run locally.

The new database suite covers complete dependent cleanup and archived evidence,
shared-data preservation, idempotent retries, stale acknowledgement, permissions,
approved/current/old/claimed/audited official history, bracket/published-statistics
blocks, audit-failure rollback and concurrent referee writes. These await CI.
PR/CI evidence and organizer review of new Chinese wording are tracked on #571;
no acceptance, merge or deployment is claimed here.

## PR update — 2026-10-31

PR #573's original `2a7dab4b` passed its complete selected core CI run
[41077828078](https://github.com/OCLR-dev/OCLR-website/actions/runs/41077828078),
including database verification, build, both core browser shards and remote
permission smoke. This resolves the original local DB execution gap for that
commit; it does not establish full regression or deployment acceptance.

The organizer subsequently authorized updating and merging #573 with the #574
BO/Ban rules. The combined head retains the latest main and both issue histories.
Its distinct CI status and final merge commit are recorded on the PR/issues.
