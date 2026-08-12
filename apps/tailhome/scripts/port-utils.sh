#!/usr/bin/env bash

# Shared port allocation helpers. This file is sourced by installer scripts.

TAILHOME_PORT_SPECS=(
  "TAILHOME_HOMEPAGE_PORT|3000|Homepage"
  "TAILHOME_GRAFANA_PORT|3001|Grafana"
  "TAILHOME_UPTIME_PORT|3002|Uptime Kuma"
  "TAILHOME_CADDY_HTTP_PORT|8088|Caddy HTTP"
  "TAILHOME_CADDY_HTTPS_PORT|8443|Caddy HTTPS"
  "TAILHOME_PROMETHEUS_PORT|9090|Prometheus"
  "TAILHOME_NODE_EXPORTER_PORT|9100|Node Exporter"
  "TAILHOME_PORTAINER_PORT|9443|Portainer"
  "TAILHOME_PIHOLE_WEB_PORT|8080|Pi-hole web"
)

tailhome_env_get() {
  local name="$1"
  local env_file="${2:-${TAILHOME_DIR}/.env}"

  [[ -f "${env_file}" ]] || return 1
  ${SUDO:-} awk -F= -v name="${name}" '$1 == name { print substr($0, index($0, "=") + 1); exit }' "${env_file}" 2>/dev/null
}

tailhome_env_upsert() {
  local name="$1"
  local value="$2"
  local env_file="${3:-${TAILHOME_DIR}/.env}"
  local temp_file

  temp_file="$(mktemp)"
  if ${SUDO:-} test -f "${env_file}"; then
    ${SUDO:-} awk -F= -v name="${name}" '$1 != name { print }' "${env_file}" > "${temp_file}"
  fi
  printf '%s=%s\n' "${name}" "${value}" >> "${temp_file}"
  ${SUDO:-} cp "${temp_file}" "${env_file}"
  ${SUDO:-} chmod 600 "${env_file}"
  rm -f -- "${temp_file}"
}

tailhome_valid_port() {
  local port="$1"
  [[ "${port}" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 ))
}

tailhome_read_sockets() {
  TAILHOME_TCP_SOCKETS=""
  TAILHOME_UDP_SOCKETS=""
  if command -v ss >/dev/null 2>&1; then
    TAILHOME_TCP_SOCKETS="$(ss -H -ltn 2>/dev/null || true)"
    TAILHOME_UDP_SOCKETS="$(ss -H -lun 2>/dev/null || true)"
  fi
}

tailhome_port_addresses() {
  local sockets="$1"
  local port="$2"

  printf '%s\n' "${sockets}" | awk -v port="${port}" '
    {
      address = $4
      if (address !~ "[:.]" port "$") {
        next
      }
      sub("[:.]" port "$", "", address)
      gsub(/^\[/, "", address)
      gsub(/\]$/, "", address)
      print address
    }
  '
}

tailhome_tcp_port_in_use() {
  local port="$1"
  tailhome_port_addresses "${TAILHOME_TCP_SOCKETS:-}" "${port}" | awk 'NF { found = 1 } END { exit found ? 0 : 1 }'
}

tailhome_address_is_loopback() {
  case "$1" in
    127.*|::1|localhost) return 0 ;;
    *) return 1 ;;
  esac
}

tailhome_dns_protocol_available() {
  local sockets="$1"
  local addresses address

  addresses="$(tailhome_port_addresses "${sockets}" 53)"
  [[ -n "${addresses}" ]] || return 0
  while IFS= read -r address; do
    [[ -n "${address}" ]] || continue
    tailhome_address_is_loopback "${address}" || return 1
  done <<< "${addresses}"
  return 0
}

tailhome_dns_port_available() {
  tailhome_dns_protocol_available "${TAILHOME_TCP_SOCKETS:-}" &&
    tailhome_dns_protocol_available "${TAILHOME_UDP_SOCKETS:-}"
}

tailhome_port_is_selected() {
  local port="$1"
  [[ ",${TAILHOME_SELECTED_PORTS:-}," == *",${port},"* ]]
}

tailhome_select_port() {
  local preferred="$1"
  local candidate="${preferred}"

  while tailhome_tcp_port_in_use "${candidate}" || tailhome_port_is_selected "${candidate}"; do
    candidate=$((candidate + 1))
    (( candidate <= 65535 )) || return 1
  done
  TAILHOME_SELECTED_PORTS="${TAILHOME_SELECTED_PORTS:+${TAILHOME_SELECTED_PORTS},}${candidate}"
  TAILHOME_RESOLVED_PORT="${candidate}"
}

tailhome_remove_profile() {
  local remove="$1"
  local profile kept=""
  local -a profiles=()

  IFS=',' read -r -a profiles <<< "${TAILHOME_PROFILES:-}"
  for profile in "${profiles[@]}"; do
    [[ "${profile}" == "${remove}" ]] && continue
    [[ -n "${profile}" ]] || continue
    kept="${kept:+${kept},}${profile}"
  done
  TAILHOME_PROFILES="${kept}"
  export TAILHOME_PROFILES
}

tailhome_resolve_ports() {
  local adjustments_file="${TAILHOME_DIR}/.port-adjustments"
  local dns_marker="${TAILHOME_DIR}/.dns-port-blocked"
  local spec variable default_port label existing preferred resolved
  local temp_adjustments

  temp_adjustments="$(mktemp)"
  TAILHOME_SELECTED_PORTS=""
  tailhome_read_sockets

  for spec in "${TAILHOME_PORT_SPECS[@]}"; do
    IFS='|' read -r variable default_port label <<< "${spec}"
    existing="$(tailhome_env_get "${variable}" 2>/dev/null || true)"
    if [[ -n "${existing}" ]]; then
      tailhome_valid_port "${existing}" || {
        printf 'error: %s in %s is not a valid port\n' "${variable}" "${TAILHOME_DIR}/.env" >&2
        rm -f -- "${temp_adjustments}"
        return 1
      }
      resolved="${existing}"
      if tailhome_port_is_selected "${resolved}"; then
        printf 'error: persisted TailHome ports collide on %s\n' "${resolved}" >&2
        rm -f -- "${temp_adjustments}"
        return 1
      fi
      TAILHOME_SELECTED_PORTS="${TAILHOME_SELECTED_PORTS:+${TAILHOME_SELECTED_PORTS},}${resolved}"
    else
      preferred="${!variable:-${default_port}}"
      tailhome_valid_port "${preferred}" || {
        printf 'error: %s must be a port from 1 to 65535\n' "${variable}" >&2
        rm -f -- "${temp_adjustments}"
        return 1
      }
      tailhome_select_port "${preferred}" || {
        printf 'error: no free port is available for %s\n' "${label}" >&2
        rm -f -- "${temp_adjustments}"
        return 1
      }
      resolved="${TAILHOME_RESOLVED_PORT}"
      if [[ "${resolved}" != "${preferred}" ]]; then
        printf '%s|%s|%s\n' "${label}" "${preferred}" "${resolved}" >> "${temp_adjustments}"
      fi
    fi
    printf -v "${variable}" '%s' "${resolved}"
    export "${variable}"
    tailhome_env_upsert "${variable}" "${resolved}"
  done

  if [[ -s "${temp_adjustments}" ]]; then
    ${SUDO:-} cp "${temp_adjustments}" "${adjustments_file}"
  else
    ${SUDO:-} rm -f -- "${adjustments_file}"
  fi
  rm -f -- "${temp_adjustments}"

  if [[ ",${TAILHOME_PROFILES:-}," == *",dns,"* ]]; then
    if tailhome_dns_port_available; then
      ${SUDO:-} rm -f -- "${dns_marker}"
    else
      tailhome_remove_profile dns
      tailhome_env_upsert COMPOSE_PROFILES "${TAILHOME_PROFILES}"
      printf 'port53\n' | ${SUDO:-} tee "${dns_marker}" >/dev/null
    fi
  fi
}

tailhome_load_resolved_ports() {
  local spec variable default_port label value

  for spec in "${TAILHOME_PORT_SPECS[@]}"; do
    IFS='|' read -r variable default_port label <<< "${spec}"
    value="$(tailhome_env_get "${variable}" 2>/dev/null || true)"
    printf -v "${variable}" '%s' "${value:-${default_port}}"
    export "${variable}"
  done
}
