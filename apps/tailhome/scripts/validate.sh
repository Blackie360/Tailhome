#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

bash -n install.sh scripts/*.sh bin/tailhome

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose config >/dev/null
else
  printf 'Skipping Docker Compose validation; docker compose is not available.\n'
fi

printf 'TailHome validation passed.\n'
