#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT="${1:-${ROOT_DIR}/dist/tailhome}"

command -v go >/dev/null 2>&1 || {
  printf 'error: Go is required to build the TailHome CLI\n' >&2
  exit 1
}

mkdir -p "$(dirname "${OUTPUT}")"
cd "${ROOT_DIR}"
go build -trimpath -ldflags="-s -w" -o "${OUTPUT}" ./cmd/tailhome
printf 'Built TailHome CLI at %s\n' "${OUTPUT}"
