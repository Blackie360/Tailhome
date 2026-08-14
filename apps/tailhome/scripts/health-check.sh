#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAILHOME_DIR="${TAILHOME_DIR:-/opt/tailhome}"
failed=0

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" || "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

# shellcheck source=port-utils.sh
. "${SCRIPT_DIR}/port-utils.sh"
TAILHOME_PROFILES="$(tailhome_env_get COMPOSE_PROFILES 2>/dev/null || true)"
tailhome_load_resolved_ports

profile_enabled() {
  [[ ",${TAILHOME_PROFILES}," == *",$1,"* ]]
}

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

check_http() {
  local name="$1"
  local url="$2"
  local attempts="${TAILHOME_HEALTH_ATTEMPTS:-5}"
  local delay="${TAILHOME_HEALTH_DELAY:-2}"
  local attempt

  [[ "${attempts}" =~ ^[1-9][0-9]*$ ]] || attempts=5
  [[ "${delay}" =~ ^[0-9]+$ ]] || delay=2
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if curl -kfsS --max-time 3 "${url}" >/dev/null 2>&1; then
      printf '[ok] %s\n' "${name}"
      return 0
    fi
    (( attempt == attempts )) || sleep "${delay}"
  done
  printf '[fail] %s (%s)\n' "${name}" "${url}"
  failed=1
}

check "docker command" command -v docker
check "docker compose" docker compose version
if command -v systemctl >/dev/null 2>&1; then
  check "docker service" systemctl is-active --quiet docker
fi

if [[ -d "${TAILHOME_DIR}" ]]; then
  check "compose file" test -f "${TAILHOME_DIR}/docker-compose.yml"
  if (cd "${TAILHOME_DIR}" && ${SUDO} docker compose ps >/dev/null 2>&1); then
    printf '[ok] compose stack\n'
  else
    printf '[fail] compose stack\n'
    failed=1
  fi
else
  printf '[fail] tailhome directory missing: %s\n' "${TAILHOME_DIR}"
  failed=1
fi

if command -v curl >/dev/null 2>&1; then
  check_http "Dashboard HTTP" "http://127.0.0.1:${TAILHOME_HOMEPAGE_PORT}"
  check_http "Caddy HTTP" "http://127.0.0.1:${TAILHOME_CADDY_HTTP_PORT}"
  if profile_enabled monitoring; then
    check_http "Grafana HTTP" "http://127.0.0.1:${TAILHOME_GRAFANA_PORT}"
    check_http "Prometheus HTTP" "http://127.0.0.1:${TAILHOME_PROMETHEUS_PORT}/-/ready"
    check_http "Node Exporter HTTP" "http://127.0.0.1:${TAILHOME_NODE_EXPORTER_PORT}/metrics"
  fi
  profile_enabled uptime && check_http "Uptime Kuma HTTP" "http://127.0.0.1:${TAILHOME_UPTIME_PORT}"
  profile_enabled management && check_http "Portainer HTTPS" "https://127.0.0.1:${TAILHOME_PORTAINER_PORT}"
  profile_enabled dns && check_http "Pi-hole HTTP" "http://127.0.0.1:${TAILHOME_PIHOLE_WEB_PORT}/admin"
fi

exit "${failed}"
