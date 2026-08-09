#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ROOT_DIR}/dist/test-tailhome"
TEST_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TEST_DIR}"
}
trap cleanup EXIT

mkdir -p "${TEST_DIR}"
cat >"${TEST_DIR}/.env" <<ENV
TAILHOME_HOSTNAME=test-tailhome
TAILHOME_TIMEZONE=UTC
TAILHOME_GRAFANA_USER=admin
TAILHOME_GRAFANA_PASSWORD=secret-grafana
TAILHOME_PIHOLE_PASSWORD=secret-pihole
ENV

cd "${ROOT_DIR}"
go test ./cmd/tailhome
"${ROOT_DIR}/scripts/build-cli.sh" "${CLI}"

run_cli() {
  TAILHOME_USE_SUDO=0 TAILHOME_DIR="${TEST_DIR}" "${CLI}" "$@"
}

assert_contains() {
  local haystack="$1"
  local needle="$2"

  if ! printf '%s' "${haystack}" | grep -Fq "${needle}"; then
    printf 'expected output to contain: %s\n' "${needle}" >&2
    printf 'actual output:\n%s\n' "${haystack}" >&2
    exit 1
  fi
}

output="$(run_cli version)"
assert_contains "${output}" "TailHome 0.1.0"

output="$(run_cli urls)"
assert_contains "${output}" "http://test-tailhome:3000"
assert_contains "${output}" "Credentials are stored in ${TEST_DIR}/.env"

output="$(run_cli config)"
assert_contains "${output}" "Install directory: ${TEST_DIR}"
assert_contains "${output}" "Hostname:          test-tailhome"

output="$(run_cli env)"
assert_contains "${output}" "TAILHOME_GRAFANA_PASSWORD=<hidden>"
assert_contains "${output}" "TAILHOME_PIHOLE_PASSWORD=<hidden>"

printf 'TailHome CLI tests passed.\n'
