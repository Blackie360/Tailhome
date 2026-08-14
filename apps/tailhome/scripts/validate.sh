#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

bash -n install.sh scripts/*.sh

if command -v go >/dev/null 2>&1; then
  scripts/test-cli.sh
  go test ./internal/dashboard
else
  printf 'Skipping Go CLI tests; go is not available.\n'
fi

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose config >/dev/null
else
  printf 'Skipping Docker Compose validation; docker compose is not available.\n'
fi

printf 'TailHome validation passed.\n'
