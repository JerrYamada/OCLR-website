#!/usr/bin/env bash
# Run as the website owner, under the shared update lock. No recursive/default ACLs.
set +x
set -Eeuo pipefail
fail() { printf '%s\n' "$1" >&2; exit 1; }
[[ ( $# == 1 && $1 == --check ) || ( $# == 2 && $1 == /* && $2 == /* ) ]] || fail 'Usage: bash scripts/backup-release-access.sh --check | INSTALL_DIR RELEASE_DIR'
# Hosts without the separately installed operator keep their existing permissions.
backup_uid=$(id -u oclr-backup 2>/dev/null) || exit 0
[[ "$backup_uid" =~ ^[0-9]+$ && "$backup_uid" != 0 && "$backup_uid" != "$EUID" ]] || fail 'A separate unprivileged backup account is required.'
command -v setfacl >/dev/null || fail 'Backup operator release access requires setfacl (Rocky: sudo dnf install acl).'
[[ $1 != --check ]] || exit 0
root=$(cd -- "$1" && pwd -P)
release=$(cd -- "$2" && pwd -P)
[[ ! -L "$root/releases" && "$release" == "$root/releases/"* && "${release#"$root/releases/"}" != */* ]] || fail 'Expected a release directly inside the installation releases directory.'
marker="$release/.oclr-release"
for directory in "$root" "$root/releases" "$release"; do
  [[ -d "$directory" && -O "$directory" ]] || fail 'Release directories must belong to the deployment account.'
done
[[ -f "$marker" && ! -L "$marker" && -O "$marker" ]] || fail 'Release marker must be a regular file owned by the deployment account.'
sha=$(<"$marker")
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || fail 'Release marker must contain the exact reviewed commit SHA.'
# The operator may traverse these directories and read only this metadata file.
# Preserve owner/group/other entries; grant no listing, writes or inherited access.
setfacl -m "u:$backup_uid:--x" -- "$root" "$root/releases" "$release"
setfacl -m "u:$backup_uid:r--" -- "$marker"
