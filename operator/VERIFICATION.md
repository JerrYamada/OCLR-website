# Local verification — 2026-10-30

Tests use synthetic data, Node 24.22.2 and a separately named local PostgreSQL 17
instance/database. No production database, credentials, service or deployment
was accessed.

- Package/auth/restore tests: 3 files, 5 tests passed. The restore test creates its
  own disposable database and exercises real pg_dump/pg_restore and transactional
  database renames. Service control and HTTP health are synthetic. It checks
  authenticated corruption rejection, media mismatch preserving the current
  database, business-data restoration and session/staff-grant invalidation.
- Deployment-lock rejection regression: 1 test passed; queued jobs remain retryable
  when flock rejects acquisition, and terminal handling runs once.
- Localization: 4 tests passed; new Simplified/Traditional Chinese wording awaits
  organizer review.
- Full unit/integration run: 1,759 passed, 1 skipped, one new route-inventory
  classification failure. After classifying backups as denied in remote mode,
  the affected read-API DX file passed all 3 tests.
- Initial desktop/mobile backup browser checks: 4 passed (confirmation gate,
  geometry and direct ordinary-user request denial). The final full browser run
  was stopped after five failures outside the backup page: admin-navigation,
  admin-polish, application-profile, archive-artwork and archive-map-metadata.
  Result: 33 passed, 5 failed, 1 interrupted, 1,019 not run. This is **not a full
  browser pass**. The final targeted backup run passed 4 tests, including desktop,
  mobile, light/dark and direct-request denial.
- Production dependency audit: 0 vulnerabilities.
- Lint/typecheck, production build and whitespace checks passed during the batch;
  final commit and CI evidence are recorded on the PR/issue.

These checks do not verify a real Rocky systemd/sudo/SELinux installation, a live
operator/update lock race, disk exhaustion, command timeout or power-loss
recovery. Operator installation and a hosted restore rehearsal remain separate
explicitly authorized acceptance work. Local results do not establish deployment
or organizer acceptance of issue #369.
