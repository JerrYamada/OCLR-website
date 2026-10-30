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

## Website-only update follow-up — 2026-10-30

The organizer confirmed that the production backup operator had not been
installed; only the website updater had run. This follow-up adds explicit host
provisioning and configuration instructions, distinguishes missing configuration
from socket/rejection errors, disables unavailable actions and prevents the
upload field from stretching the create button.

- Six desktop/mobile backup browser tests passed, including missing installation,
  recovery, light/dark geometry and authorization. A separate loopback port was
  used because the normal browser-test port was already occupied; the focused
  backup page does not use provider fixtures.
- Thirteen targeted unit tests passed (including localization, diagnostics,
  installer preview/syntax, helper hashing, package and authorization boundaries).
- Real isolated PostgreSQL round-trip passed with a release-marker file overriding
  a stale configured release and a canonical Host requirement on local health.
- Dependency audit: zero production vulnerabilities. Application build and
  lint/typecheck passed. Final full unit/integration evidence is on the PR.
- Installer apply, real Rocky systemd/sudo/SELinux provisioning and production
  service startup were **not performed**. Production remains dependent on the
  one-time installation and privately approved operator DB configuration.

Final follow-up unit/integration run: **219 files passed; 1,768 tests passed,
1 skipped**. The preliminary run caught the download error classification while
that change was being added; the corrected committed source passed the final
full run. Review also closes the shared lock descriptor in unprivileged git/npm
children; installer syntax/preview tests passed again after that change.

Provisioner isolation follow-up: control sources/helpers remain root-owned
throughout dependency installation. Dependencies are staged separately with
lifecycle scripts disabled; only node_modules is copied into the release.
Installer syntax/preview tests passed, and a real temporary `npm ci --ignore-scripts`
installation successfully ran the operator TypeScript loader. No host provisioning
or real operator installation was performed by the agent.

Private-listener configuration follow-up: health probes now support the explicitly
configured private IPv4 listener only when that IP is assigned to this app host
and its port matches. Other hosts, wildcard/public targets and non-health URLs
are rejected before stopping the service. Three focused target-validation tests
and the real isolated PostgreSQL round trip passed; installer/helper regressions
also passed. No live listener, firewall or production service was changed.
