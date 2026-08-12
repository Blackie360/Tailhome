#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAILHOME_VERSION="0.1.0"
DEFAULT_TAILHOME_PROFILES="monitoring,uptime,management,dns"
TAILHOME_DIR="${TAILHOME_DIR:-/opt/tailhome}"
TAILHOME_HOSTNAME="${TAILHOME_HOSTNAME:-tailhome}"
TAILHOME_BIN_DIR="${TAILHOME_BIN_DIR:-/usr/local/bin}"
TAILHOME_CLI_BUILD_DIR="${TAILHOME_CLI_BUILD_DIR:-${PROJECT_DIR}/dist}"
if [[ -v TAILHOME_PROFILES ]]; then
  TAILHOME_PROFILES_PRESET=1
else
  TAILHOME_PROFILES_PRESET=0
  TAILHOME_PROFILES=""
fi

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" ]]; then
  SUDO=""
elif [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null 2>&1 || {
    printf 'error: sudo is required\n' >&2
    exit 1
  }
  SUDO="sudo"
fi

existing_profiles() {
  local env_file="${TAILHOME_DIR}/.env"

  [[ -f "${env_file}" ]] || return 1
  ${SUDO} awk -F= '$1 == "COMPOSE_PROFILES" { print substr($0, index($0, "=") + 1); exit }' "${env_file}" 2>/dev/null || true
}

initial_profiles() {
  if existing_profiles; then
    return 0
  fi
  printf '%s' "${DEFAULT_TAILHOME_PROFILES}"
}

normalize_profiles() {
  local raw="${TAILHOME_PROFILES:-}"
  local profile normalized=""
  local -a profiles=()

  IFS=',' read -r -a profiles <<< "${raw}"
  TAILHOME_PROFILES=""
  for profile in "${profiles[@]}"; do
    profile="${profile//[[:space:]]/}"
    [[ -n "${profile}" ]] || continue
    case "${profile}" in
      monitoring|uptime|management|dns) ;;
      *)
        printf 'error: unknown service profile: %s\n' "${profile}" >&2
        exit 1
        ;;
    esac
    if [[ ",${normalized}," != *",${profile},"* ]]; then
      normalized="${normalized:+${normalized},}${profile}"
    fi
  done
  TAILHOME_PROFILES="${normalized}"
  export TAILHOME_PROFILES
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '\n'
  else
    date +%s%N | sha256sum | awk '{print $1}'
  fi
}

download() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${url}" -o "${output}"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "${output}" "${url}"
  else
    return 1
  fi
}

detect_cli_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'amd64' ;;
    arm64|aarch64) printf 'arm64' ;;
    armv7l) printf 'armv7' ;;
    armv6l) printf 'armv6' ;;
    *) return 1 ;;
  esac
}

profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES}," == *",${profile},"* ]]
}

remove_profile() {
  local profile="$1"
  local current kept=""
  local -a profiles=()

  IFS=',' read -r -a profiles <<< "${TAILHOME_PROFILES:-}"
  for current in "${profiles[@]}"; do
    [[ "${current}" != "${profile}" ]] || continue
    kept="${kept:+${kept},}${current}"
  done
  TAILHOME_PROFILES="${kept}"
  export TAILHOME_PROFILES
}

update_env_profiles() {
  if [[ -f "${TAILHOME_DIR}/.env" ]] && ${SUDO} grep -q '^COMPOSE_PROFILES=' "${TAILHOME_DIR}/.env"; then
    ${SUDO} sed -i "s/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=${TAILHOME_PROFILES}/" "${TAILHOME_DIR}/.env"
  else
    printf 'COMPOSE_PROFILES=%s\n' "${TAILHOME_PROFILES}" | ${SUDO} tee -a "${TAILHOME_DIR}/.env" >/dev/null
  fi
}

compose() {
  ${SUDO} docker compose "$@"
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

download_cli() {
  output="$1"
  arch="$(detect_cli_arch)" || return 1
  version="${TAILHOME_INSTALL_VERSION:-main-latest}"
  repo="${TAILHOME_INSTALL_REPO:-Blackie360/Tailhome}"
  url="${TAILHOME_CLI_URL:-https://github.com/${repo}/releases/download/${version}/tailhome-linux-${arch}}"

  printf 'Downloading TailHome CLI from %s\n' "${url}"
  mkdir -p "$(dirname "${output}")"
  download "${url}" "${output}" || return 1
  chmod +x "${output}"
}

warn_for_tmp_install_dir() {
  case "${TAILHOME_DIR}" in
    /tmp|/tmp/*)
      warn "TAILHOME_DIR is under /tmp; Docker Desktop or rootless Docker may not share this path. Prefer /opt/tailhome, a path under your home directory, or another Docker-shared location."
      ;;
  esac
}

start_service() {
  local description="$1"
  shift

  if ! compose up -d "$@"; then
    warn "${description} could not start; continuing with the rest of the TailHome stack."
    return 1
  fi
}

disable_dns_profile() {
  local reason="$1"
  remove_profile dns
  update_env_profiles
  if [[ "${reason}" == "port53" ]]; then
    printf 'port53\n' | ${SUDO} tee "${TAILHOME_DIR}/.dns-port-blocked" >/dev/null
    ${SUDO} rm -f -- "${TAILHOME_DIR}/.dns-start-failed"
  else
    printf '%s\n' "${reason}" | ${SUDO} tee "${TAILHOME_DIR}/.dns-start-failed" >/dev/null
    ${SUDO} chmod 600 "${TAILHOME_DIR}/.dns-start-failed"
  fi
  tailhome_write_consumer_configs
  compose rm -sf pihole >/dev/null 2>&1 || true
}

start_stack() {
  compose pull --policy missing
  compose up -d homepage caddy

  if profile_enabled monitoring; then
    start_service "Grafana and Prometheus" grafana prometheus || true
    if ! compose up -d node-exporter; then
      warn "Node Exporter could not start, often because this Docker setup does not support the host root mount. Grafana and Prometheus remain enabled."
      compose rm -sf node-exporter >/dev/null 2>&1 || true
    fi
  fi

  profile_enabled uptime && start_service "Uptime Kuma" uptime-kuma || true
  profile_enabled management && start_service "Portainer" portainer || true
  if profile_enabled dns; then
    pihole_output=""
    if ! pihole_output="$(compose up -d pihole 2>&1)"; then
      if printf '%s' "${pihole_output}" | grep -Eqi '(:53|port 53).*(address already in use|bind)|((address already in use|bind).*(port 53|:53))'; then
        disable_dns_profile port53
      else
        disable_dns_profile "$(printf '%s\n' "${pihole_output:-Pi-hole failed to start}" | head -n 1 | cut -c1-240)"
        warn "Pi-hole could not start; the dns profile was disabled."
      fi
    else
      ${SUDO} rm -f -- "${TAILHOME_DIR}/.dns-port-blocked" "${TAILHOME_DIR}/.dns-start-failed"
    fi
  fi
}

if [[ "${TAILHOME_PROFILES_PRESET}" -eq 0 ]]; then
  TAILHOME_PROFILES="$(initial_profiles)"
fi
normalize_profiles

warn_for_tmp_install_dir
${SUDO} mkdir -p "${TAILHOME_DIR}"
${SUDO} cp -R "${PROJECT_DIR}/configs" "${TAILHOME_DIR}/"
${SUDO} cp -R "${PROJECT_DIR}/scripts" "${TAILHOME_DIR}/"
${SUDO} cp "${PROJECT_DIR}/docker-compose.yml" "${TAILHOME_DIR}/docker-compose.yml"
${SUDO} chmod +x "${TAILHOME_DIR}"/scripts/*.sh

if [[ ! -f "${TAILHOME_DIR}/.env" ]]; then
  grafana_password="${TAILHOME_GRAFANA_PASSWORD:-$(random_password)}"
  pihole_password="${TAILHOME_PIHOLE_PASSWORD:-$(random_password)}"
  timezone="${TAILHOME_TIMEZONE:-$(cat /etc/timezone 2>/dev/null || printf 'UTC')}"

  ${SUDO} tee "${TAILHOME_DIR}/.env" >/dev/null <<ENV
TAILHOME_HOSTNAME=${TAILHOME_HOSTNAME}
TAILHOME_TIMEZONE=${timezone}
COMPOSE_PROFILES=${TAILHOME_PROFILES}
TAILHOME_ENABLE_EXIT_NODE=${TAILHOME_ENABLE_EXIT_NODE:-0}
TAILHOME_SUBNET_ROUTES=${TAILHOME_SUBNET_ROUTES:-}
TAILHOME_GRAFANA_USER=admin
TAILHOME_GRAFANA_PASSWORD=${grafana_password}
TAILHOME_PIHOLE_PASSWORD=${pihole_password}
ENV
elif ${SUDO} grep -q '^COMPOSE_PROFILES=' "${TAILHOME_DIR}/.env"; then
  ${SUDO} sed -i "s/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=${TAILHOME_PROFILES}/" "${TAILHOME_DIR}/.env"
else
  printf 'COMPOSE_PROFILES=%s\n' "${TAILHOME_PROFILES}" | ${SUDO} tee -a "${TAILHOME_DIR}/.env" >/dev/null
fi

# shellcheck source=port-utils.sh
. "${PROJECT_DIR}/scripts/port-utils.sh"
# shellcheck source=stack-config.sh
. "${PROJECT_DIR}/scripts/stack-config.sh"
tailhome_resolve_ports
tailhome_write_consumer_configs

cli_source="${TAILHOME_CLI_BUILD_DIR}/tailhome"
if [[ ! -x "${cli_source}" ]]; then
  bundled_cli="${PROJECT_DIR}/dist/tailhome-linux-$(detect_cli_arch)"
  if [[ -x "${bundled_cli}" ]]; then
    mkdir -p "$(dirname "${cli_source}")"
    cp "${bundled_cli}" "${cli_source}"
    chmod +x "${cli_source}"
    printf 'Using the bundled TailHome CLI for %s.\n' "$(uname -m)"
  elif ! download_cli "${cli_source}"; then
    if command -v go >/dev/null 2>&1; then
      printf 'Falling back to local Go build for TailHome CLI.\n'
      "${PROJECT_DIR}/scripts/build-cli.sh" "${cli_source}"
    else
      printf 'error: could not download TailHome CLI and Go is not installed for local build.\n' >&2
      printf 'Set TAILHOME_CLI_URL to a prebuilt binary or publish the %s release assets.\n' "${TAILHOME_INSTALL_VERSION:-main-latest}" >&2
      exit 1
    fi
  fi
fi

${SUDO} mkdir -p "${TAILHOME_BIN_DIR}"
${SUDO} cp "${cli_source}" "${TAILHOME_BIN_DIR}/tailhome"
${SUDO} chmod +x "${TAILHOME_BIN_DIR}/tailhome"

cd "${TAILHOME_DIR}"
if [[ "${TAILHOME_NO_START:-0}" == "1" ]]; then
  docker compose config >/dev/null
  printf 'TailHome stack rendered successfully. Skipping container start.\n'
else
  start_stack
fi

printf 'TailHome stack created at %s.\n' "${TAILHOME_DIR}"
