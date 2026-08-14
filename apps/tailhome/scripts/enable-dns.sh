#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAILHOME_DIR="${TAILHOME_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" || "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null 2>&1 || {
    printf 'error: sudo is required\n' >&2
    exit 1
  }
  SUDO="sudo"
fi

# shellcheck source=port-utils.sh
. "${SCRIPT_DIR}/port-utils.sh"
# shellcheck source=stack-config.sh
. "${SCRIPT_DIR}/stack-config.sh"

[[ -f "${TAILHOME_DIR}/.env" ]] || {
  printf 'error: TailHome environment file not found: %s/.env\n' "${TAILHOME_DIR}" >&2
  exit 1
}
[[ -f "${TAILHOME_DIR}/docker-compose.yml" ]] || {
  printf 'error: TailHome Compose file not found: %s/docker-compose.yml\n' "${TAILHOME_DIR}" >&2
  exit 1
}

TAILHOME_PROFILES="$(tailhome_env_get COMPOSE_PROFILES 2>/dev/null || true)"
tailhome_load_resolved_ports

if [[ ",${TAILHOME_PROFILES}," == *",dns,"* ]] && [[ ! -f "${TAILHOME_DIR}/.dns-port-blocked" ]]; then
  if (cd "${TAILHOME_DIR}" && ${SUDO} docker compose ps --status running --services pihole 2>/dev/null | grep -qx pihole); then
    printf 'Pi-hole DNS is already enabled.\n'
    printf 'Web interface: http://%s:%s/admin\n' "$(tailhome_env_get TAILHOME_HOSTNAME 2>/dev/null || printf tailhome)" "${TAILHOME_PIHOLE_WEB_PORT}"
    exit 0
  fi
fi

tailhome_read_sockets

if ! tailhome_dns_port_available; then
  cat >&2 <<'MSG'
Pi-hole DNS was not started because port 53 is occupied.
Free TCP and UDP port 53, then run:
  tailhome enable dns
MSG
  exit 1
fi

# Pi-hole's HTTP endpoint can move safely when it became occupied while DNS was disabled.
if tailhome_tcp_port_in_use "${TAILHOME_PIHOLE_WEB_PORT}"; then
  TAILHOME_SELECTED_PORTS=""
  for spec in "${TAILHOME_PORT_SPECS[@]}"; do
    IFS='|' read -r variable _ _ <<< "${spec}"
    [[ "${variable}" == "TAILHOME_PIHOLE_WEB_PORT" ]] && continue
    value="${!variable}"
    TAILHOME_SELECTED_PORTS="${TAILHOME_SELECTED_PORTS:+${TAILHOME_SELECTED_PORTS},}${value}"
  done
  previous_port="${TAILHOME_PIHOLE_WEB_PORT}"
  tailhome_select_port "${previous_port}" || {
    printf 'error: no free HTTP port is available for Pi-hole\n' >&2
    exit 1
  }
  TAILHOME_PIHOLE_WEB_PORT="${TAILHOME_RESOLVED_PORT}"
  export TAILHOME_PIHOLE_WEB_PORT
  tailhome_env_upsert TAILHOME_PIHOLE_WEB_PORT "${TAILHOME_PIHOLE_WEB_PORT}"
fi

if [[ ",${TAILHOME_PROFILES}," != *",dns,"* ]]; then
  TAILHOME_PROFILES="${TAILHOME_PROFILES:+${TAILHOME_PROFILES},}dns"
fi
export TAILHOME_PROFILES
tailhome_env_upsert COMPOSE_PROFILES "${TAILHOME_PROFILES}"
tailhome_write_consumer_configs

cd "${TAILHOME_DIR}"
start_output=""
if ! start_output="$(${SUDO} docker compose up -d dashboard caddy pihole 2>&1)"; then
  tailhome_remove_profile dns
  tailhome_env_upsert COMPOSE_PROFILES "${TAILHOME_PROFILES}"
  tailhome_write_consumer_configs
  diagnostic="$(printf '%s\n' "${start_output:-Pi-hole failed to start}" | head -n 1 | cut -c1-240)"
  printf '%s\n' "${diagnostic}" | ${SUDO} tee "${TAILHOME_DIR}/.dns-start-failed" >/dev/null
  ${SUDO} chmod 600 "${TAILHOME_DIR}/.dns-start-failed"
  ${SUDO} rm -f -- "${TAILHOME_DIR}/.dns-port-blocked"
  printf 'error: Pi-hole could not start; the dns profile remains disabled: %s\n' "${diagnostic}" >&2
  exit 1
fi

${SUDO} rm -f -- "${TAILHOME_DIR}/.dns-port-blocked" "${TAILHOME_DIR}/.dns-start-failed"
printf 'Pi-hole DNS is enabled.\n'
printf 'Web interface: http://%s:%s/admin\n' "$(tailhome_env_get TAILHOME_HOSTNAME 2>/dev/null || printf tailhome)" "${TAILHOME_PIHOLE_WEB_PORT}"
