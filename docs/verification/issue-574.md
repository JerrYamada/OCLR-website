# #574 — Round BO, repeat Ban presets and NM controls

Date: 2026-10-30 (Asia/Taipei). Branch: `codex/round-bo-ban-policy`.

## Behavior

- The round referee form exposes BO using the existing first-to series, with
  odd-number validation. Saving BO and BP is one transaction guarded by round
  version, policy revision, current Admin capability and existing history checks.
  Other scoring fields and standings are preserved, with a new audited scoring
  release when BO changes. Missing/fixed-map scoring is not guessed or converted;
  the form links to the existing scoring configuration.
- Unmodified S11 draft steps follow a BO change. Saved/customized sequences are
  preserved; incompatible TB/Pick counts reject the transaction without changing
  scoring. Active selections and approved/locked history remain protected.
- Three exclusive repeat Ban presets: all categories, only NM/FM, or none, per
  team across Ban phases. Existing custom exceptions survive unchanged saves.
  TB is still never bannable. The stored Ban schema and desktop contract remain
  compatible.
- NM Mods/Freemod inputs are removed. Explicit form saves restore canonical NM
  (`mods: []`, `freemod: false`); NF remains separate. Existing NM overrides have
  a visible warning before save. Other category overrides and referee history
  remain intact; reads do not rewrite saved policies.

## Verification

Node.js 24.22.2, npm, existing lockfile; `npm ci --ignore-scripts`.

- `npm run check` passed.
- `npm run build` completed; the first restricted build stalled and was stopped
  before retrying with the required local-process permissions.
- Full available `npm test`: **1,245 passed, 576 skipped**, 159 passing files.
  Initial restricted-environment attempts could not use local listeners; the
  completed rerun used the required local-process permissions. It also includes
  the existing #570 generated-profile contract synchronization commit `01c81d28`
  already submitted separately, without changing profile application behavior.
- Browser component tests: **24 passed**, desktop/mobile Chrome, three locales,
  light/dark and 320px; covers BO/default sequence, exclusive Ban options, legacy
  exceptions, canonical NM save, preservation of custom steps, version-conflict
  drafts and read-only/missing/fixed-map scoring boundaries.
  The affected BO/Ban/scoring cases were confirmed again after the final
  save-response state adjustment: **6 passed**.
- i18n extraction/checks and diff/format checks passed. `npm audit --omit=dev`:
  **0 vulnerabilities**.

Fresh isolated PostgreSQL initialization failed because the host exhausted shared
memory IDs (`shmget`, 56 bytes). Docker's local daemon was unavailable. No existing
database, service or kernel setting was modified. Database integration and
full-site E2E were not run locally. Added DB cases cover atomic scoring/BP/audit,
round version conflicts and rollback for incompatible BO/TB or missing scoring.
Existing permission, active-selection and completed-history tests remain in place.

Build/CI status is recorded on #574 after completion. Chinese wording requires
organizer review; no merge, deployment or real tournament data edit is claimed.

## PR integration — 2026-10-31

The organizer requested updating and merging the existing PR #573. The #574
change is now combined there with #571, retaining both issue commits and the
latest main (#576); no history was rewritten.

The branch CI run [41081292009](https://github.com/OCLR-dev/OCLR-website/actions/runs/41081292009)
at `6584b0ca` completed build, core browser and remote permission smoke successfully.
Unit/integration reported **1,820 passed, 1 failed**. The only failure was the new
BO audit assertion expecting one total event despite the fixture seed already
having a scoring audit. The assertion now checks exactly one newly created event
and its round identity, before/after version and scoring series. No application
behavior was changed for this test correction. Combined-head CI is recorded in
the PR and issues separately from this historical result.
