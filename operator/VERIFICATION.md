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

Node 22 installer follow-up: the host reported Node 22.23.2/npm 10.9.8. The
installer's exact-major-24 guard was inconsistent with package.json and the
production entry point (minimum 22.13). It now uses the same minimum requirement
for /usr/bin/node and retains Node 24 as preferred. Boundary tests accept 22.13.0,
22.23.2 and 24, and reject older/invalid versions. Eleven focused tests passed
under an actual Node 22.23.2 process, including daemon/socket, health target,
installer/helper and encryption coverage. No host runtime was upgraded and no
production key was generated by the agent.

Release-marker permission follow-up: the host confirmed the backup UID could not
read the private current release marker. The installer and updater now grant
execute-only ACLs on its parent directories and read-only access on that marker.
Updates apply this before maintenance, also on same-SHA retries, and fail before
stopping the app if access cannot be granted. No recursive/default ACLs or extra
sudo commands are added. The targeted deployment/installer/helper suite passed
48 tests under Node 24, with one real-Linux-ACL test skipped on macOS. CI installs
the acl tools to exercise that test on Linux. Lint/types, Bash syntax and diff
checks passed; production dependency audit found zero vulnerabilities. This is
local synthetic verification, not a production backup/restore acceptance claim.

Ledger permission preflight follow-up: a synthetic dedicated PostgreSQL role
with schema USAGE but no ledger SELECT reproduces a failure after service control
in the old worker. The updated worker checks the exact ledger columns after actor
authorization and before service control. The regression asserts a failed
`database-preflight` audit phase, original-preserved recovery and an empty mock
service-command log. Granting ledger SELECT makes the query succeed. The same
test then completes the existing encrypted backup/import/restore round trip and
credential/grant invalidation checks. Eleven focused tests and lint/types passed
under Node 24 against disposable isolated test databases. No production role
grants, services or data were changed by the agent. This worker change needs a
separate reviewed operator upgrade; website-only updates do not install it.
