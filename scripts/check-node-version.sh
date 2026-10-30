#!/usr/bin/env bash
# Match package.json and production.sh: Node >=22.13; Node 24 is preferred.
set -Eeuo pipefail
node_bin=${1:-node}
version=$("$node_bin" --version) || exit 1
[[ "$version" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || exit 1
(( BASH_REMATCH[1] > 22 || (BASH_REMATCH[1] == 22 && BASH_REMATCH[2] >= 13) ))
