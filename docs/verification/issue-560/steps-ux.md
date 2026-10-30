# #560 follow-up: compact steps and repeated Mod Bans

Date: 2026-10-30 (Asia/Taipei). Branch: `codex/560-compact-policy-steps`.

## Behavior

- Step rows combine action and acting order into one selector. Up/down/remove
  controls stay alongside it; category and specific-map limits are optional
  disclosures. Categories use buttons and map limits use a searchable checklist.
  Stable row keys preserve expanded limits, selected entries and search when
  reordering. Existing saved limits remain intact.
- Default Ban steps have no category/entry restrictions. TB is always forbidden
  for Ban, enforced by the pure validator shared with the server, including a
  policy with no explicit TB step.
- Optional `banCategoryRules` controls same-team repeats across Ban phases.
  S11 draft defaults prohibit repeats with NM/FM exceptions. Legacy policies
  retain allowed-repeat behavior unless Admin explicitly changes the control.
  Opponent Bans, Picks and withdrawn selections do not consume the team's limit.
  The setting does not permit reuse of a selected map or a TB Ban.
- Saved-read 1.7.0 and generated OpenAPI document the optional field. The desktop
  IRC client requires the matching shared-model update before reading a policy
  with the new field; its strict parser must not discard the restriction.

## Local verification

Node.js 24.22.2, existing npm lockfiles; no dependency changes.

- `npm run check`, `npm run build`, i18n extraction/checks, generated contracts,
  OpenAPI/coverage checks, formatting and `git diff --check`: passed.
- Full available website suite: 1,227 passed, 573 skipped (156 files passed,
  67 skipped). Database-dependent cases were not run locally because no isolated
  test DB was configured; the earlier #560 shared-memory initialization failure
  remains documented separately. No demo or production DB was used.
- Actual client-component browser suite: 16 passed, desktop and mobile Chrome.
  Includes compact geometry, no native multi-select lists, optional limits,
  searchable entries, stable reorder, repeat controls, legacy save preservation,
  revision conflicts, read-only mode, three locales, both themes and 320px width.
  Two compact-row cases were rerun to capture and inspect final row screenshots.
- Formal dependency audit: 0 vulnerabilities.
- Companion IRC shared-model type check and 148 core/contract tests passed,
  including acceptance of the optional field, invalid TB exceptions and local
  validation of repeated HD and TB Bans. UI/preload were unchanged; no real IRC,
  OAuth, Electron live session or deployment was exercised.

The new round-policy database persistence/validation case awaits core CI. CI and
new Chinese wording/organizer acceptance are tracked on #560, separately from
implementation. No merge, deployment or issue closure is claimed here.
