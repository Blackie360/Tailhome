#!/usr/bin/env bash
set -Eeuo pipefail

TAILHOME_DIR="${TAILHOME_DIR:-/opt/tailhome}"
failed=0

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" ]]; then
  SUDO=""
elif [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

check() {
  local name="$1"
  shift

  if "$@" >/dev/null 2>&1; then
    printf '[ok] %s\n' "${name}"
  else
    printf '[fail] %s\n' "${name}"
    failed=1
  fi
}

check "tailscale command" command -v tailscale
check "docker command" command -v docker
check "docker compose" docker compose version

if command -v systemctl >/dev/null 2>&1; then
  check "tailscaled service" systemctl is-active --quiet tailscaled
  check "docker service" systemctl is-active --quiet docker
fi

if [[ -d "${TAILHOME_DIR}" ]]; then
  check "compose file" test -f "${TAILHOME_DIR}/docker-compose.yml"
  (
    cd "${TAILHOME_DIR}"
    check "compose stack" ${SUDO} docker compose ps
  )
else
  printf '[fail] tailhome directory missing: %s\n' "${TAILHOME_DIR}"
  failed=1
fi

exit "${failed}"
