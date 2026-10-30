# Admin backup operator (#369)

This service runs on the app host as a separate `oclr-backup` account. The
website connects through a mode-0660 Unix socket and never receives the
operator database credentials or encryption key. Every website request requires
a fresh global Admin check; edition Admin and Developer/remote reads are denied.
The worker rechecks the actor against the current database before doing work.

## Operator preparation

Installation and real restores require separately authorized operator work.
Install this reviewed source and its locked npm dependencies into
`/opt/oclr-backup`, owned by root and not writable by either service account.
Use Node 24, PostgreSQL client tools matching the server, and util-linux flock.
Provision a private mode-0700 `/var/lib/oclr-backup`, owned by `oclr-backup`.
Install the example systemd service with a root-owned mode-0600 environment file:

```
OCLR_OPERATOR_DATA=/var/lib/oclr-backup
OCLR_OPERATOR_SOCKET=/run/oclr-backup/operator.sock
OCLR_OPERATOR_LOCK=/opt/oclr/.update.lock
OCLR_OPERATOR_KEY=/etc/oclr-backup/package.key
OCLR_OPERATOR_DATABASE_URL=postgresql://OPERATOR@DB_HOST/DB_NAME?sslmode=disable
OCLR_OPERATOR_RUNTIME_ROLE=oclr_runtime
OCLR_OPERATOR_RELEASE=FULL_40_CHARACTER_REVIEWED_RELEASE_SHA
OCLR_OPERATOR_HEALTH_URL=http://127.0.0.1:3000/api/health
OCLR_ENVIRONMENT=production
OCLR_SERVICE=oclr.service
OCLR_MEDIA_DIR=/var/lib/oclr/media
ADMIN_OSU_IDS=APPROVED_RECOVERY_ADMIN_IDS
```

Use the actual password privately in the operator-only configuration; never put
it in argv, source control, the website's environment or logs. Preserve the
approved internal transport choice or use `verify-full` and a trusted CA. The
operator role must own the existing application database and objects and have
CREATEDB; the runtime role must remain separate and unprivileged. Have the DBA
review this ownership and the absence of other application writers first.

Generate a private random **32-byte binary key**, readable only by the operator.
Keep an encrypted offline copy: loss of this key makes packages unrecoverable.
Only packages made with this installation's key are trusted. Do not accept a
foreign dump, SQL file, supplied key or unverified migration/application version.

Pre-provision the updater's existing lock file as group `oclr`, mode 0660, without
replacing a held lock inode. Both operator and updater must have access to the
same inode. The operator account needs exactly these sudoers commands:

```
oclr-backup ALL=(root) NOPASSWD: /usr/bin/systemctl stop oclr.service, /usr/bin/systemctl start oclr.service
```

It must not receive arbitrary sudo or permission to modify the target service.
The website needs only `OCLR_OPERATOR_SOCKET`; its account must have socket group
access. Keep the parent directory operator-owned and inaccessible to other users.
Allow the operator read-only access to durable media. Adapt SELinux policy while
keeping enforcement enabled. Set the proxy's upload limit to 65 MiB for this
route only; retain authentication, HTTPS, request timeouts and no shared caching.

## Format and scope

Format 1 is an AES-256-GCM authenticated encrypted envelope containing a
PostgreSQL custom archive and authenticated metadata: UTC creation time, source,
exact release, schema migration hash, PostgreSQL major, row counts, SHA-256 and
media-tree fingerprint. The custom dump includes all database schemas and
application tables, identities, private answers, publication state, grants,
audit history and the Drizzle ledger. Database passwords, host configuration,
runtime.env and OAuth client secrets are not exported. Cluster roles and grants
are operator configuration; database ACLs and ownership are deliberately omitted.

**Media bytes are not included.** Preserve the corresponding durable media tree
separately. Restore refuses if its exact filenames/content fingerprint differs.
A database package alone is not a complete website disaster-recovery backup.

Limits are 64 MiB per archive/upload, 20 jobs and at least 256 MiB free package
disk space; databases larger than 64 MiB are rejected before dumping. Each
external command has a five-minute timeout. Completed/imported/failed packages
expire after seven days when another job is submitted; no cleanup runs during
active work. Operators must monitor disk space and PostgreSQL capacity for a
second full database plus the retained original. Interrupted plaintext scratch
files require operator cleanup with the service stopped. Never expose this data
root through Nginx, static assets, browser caches or generic logs.

## Restore and recovery

The Admin uploads and validates a package, reviews its source/time/release and
explicitly types REPLACE. Submission returns a persisted job ID. The worker
acquires the **same flock as update/cleanup**, stops the app, takes a verified
current backup, and restores into a new isolated database. It checks migration
history and all table row counts before touching the active database name.
Restore clears sessions, OAuth states and Developer tokens and revokes all
snapshot staff grants; the operator-configured recovery Admin can sign in and
regrant roles after review. Competition/publication data stays as saved.

Database renames happen in one PostgreSQL transaction while the service is
stopped. The original database is retained under a job-specific `_p_` name. The
worker starts the service and verifies exact-release local health. Any failure
after switching keeps the app stopped for deliberate operator recovery. Failed
jobs disclose only a generic state and a recovery classification; diagnostics
and the append-only actor/job audit live outside the restored database.

A failure before switching preserves the original database and attempts to
restart it. Uncertain/interrupted work blocks new jobs until the operator checks
the service, active database and retained candidate/original and updates the
private job recovery record. Never automatically drop recovery databases or
restore over an active database. Audit records survive package expiry and old
snapshot restoration. Back them up separately with restricted access.
