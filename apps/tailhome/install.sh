#!/usr/bin/env bash
set -Eeuo pipefail

TAILHOME_VERSION="0.1.0"
DEFAULT_TAILHOME_PROFILES="monitoring,uptime,management,dns"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEP_NUMBER=0
STEP_TOTAL=5
INTERACTIVE=0
TTY_FD=3

if [[ "${NO_COLOR:-0}" == "1" ]]; then
  BLUE=""
  GREEN=""
  YELLOW=""
  RED=""
  BOLD=""
  MUTED=""
  RESET=""
else
  BLUE='\033[1;34m'
  GREEN='\033[1;32m'
  YELLOW='\033[1;33m'
  RED='\033[1;31m'
  BOLD='\033[1m'
  MUTED='\033[2m'
  RESET='\033[0m'
fi

log() {
  printf '%b==>%b %s\n' "${BLUE}" "${RESET}" "$*"
}

step() {
  STEP_NUMBER=$((STEP_NUMBER + 1))
  printf '\n%b[%s/%s]%b %b%s%b\n' "${BLUE}" "${STEP_NUMBER}" "${STEP_TOTAL}" "${RESET}" "${BOLD}" "$*" "${RESET}"
}

success() {
  printf '%b✓%b %s\n' "${GREEN}" "${RESET}" "$*"
}

warn() {
  printf '%bwarning:%b %s\n' "${YELLOW}" "${RESET}" "$*" >&2
}

fail() {
  printf '%berror:%b %s\n' "${RED}" "${RESET}" "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
TailHome ${TAILHOME_VERSION}

Usage:
  ./install.sh [options]

Options:
  --skip-tailscale-install  Do not install Tailscale
  --skip-tailscale-login    Do not run the Tailscale login flow
  --skip-docker-install     Do not install Docker
  --no-start                Render the stack without starting containers
  --non-interactive         Use flags and environment values without prompts
  -y, --yes                 Same as --non-interactive
  -h, --help                Show this help

Environment:
  TAILHOME_DIR=/opt/tailhome
  TAILHOME_HOSTNAME=tailhome
  TAILHOME_ENABLE_EXIT_NODE=0
  TAILHOME_SUBNET_ROUTES=192.168.1.0/24
  TAILHOME_PROFILES=monitoring,uptime,management,dns
  TAILHOME_HOMEPAGE_PORT=3000
  TAILHOME_GRAFANA_PORT=3001
  TAILHOME_UPTIME_PORT=3002
  TAILHOME_CADDY_HTTP_PORT=8088
  TAILHOME_CADDY_HTTPS_PORT=8443
  TAILHOME_PROMETHEUS_PORT=9090
  TAILHOME_NODE_EXPORTER_PORT=9100
  TAILHOME_PORTAINER_PORT=9443
  TAILHOME_PIHOLE_WEB_PORT=8080
  TAILHOME_INTERACTIVE=0
  TAILHOME_USE_SUDO=0
  TAILHOME_TAILSCALE_LOGIN_TIMEOUT=180
USAGE
}

banner() {
  printf '%b' "${BLUE}"
  cat <<'BANNER'
  ______      _ __  __
 /_  __/___ _(_) / / /___  ____ ___  ___
  / / / __ `/ / /_/ / __ \/ __ `__ \/ _ \
 / / / /_/ / / __  / /_/ / / / / / /  __/
/_/  \__,_/_/_/ /_/\____/_/ /_/ /_/\___/
BANNER
  printf '%bPrivate home services, connected simply.%b\n\n' "${BOLD}" "${RESET}"
}

prompt_value() {
  local variable_name="$1"
  local label="$2"
  local default_value="$3"
  local validator="$4"
  local value

  while true; do
    printf '%b?%b %s %b[%s]%b: ' "${GREEN}" "${RESET}" "${label}" "${MUTED}" "${default_value}" "${RESET}" >&${TTY_FD}
    IFS= read -r value <&${TTY_FD} || fail "onboarding was cancelled"
    value="${value:-${default_value}}"
    if "${validator}" "${value}"; then
      printf -v "${variable_name}" '%s' "${value}"
      return
    fi
  done
}

prompt_yes_no() {
  local label="$1"
  local default_answer="$2"
  local hint answer

  if [[ "${default_answer}" == "yes" ]]; then
    hint="Y/n"
  else
    hint="y/N"
  fi

  while true; do
    printf '%b?%b %s %b[%s]%b: ' "${GREEN}" "${RESET}" "${label}" "${MUTED}" "${hint}" "${RESET}" >&${TTY_FD}
    IFS= read -r answer <&${TTY_FD} || fail "onboarding was cancelled"
    case "${answer}" in
      "") [[ "${default_answer}" == "yes" ]] && return 0 || return 1 ;;
      y|Y|yes|YES|Yes) return 0 ;;
      n|N|no|NO|No) return 1 ;;
      *) printf '%bPlease answer y or n.%b\n' "${YELLOW}" "${RESET}" >&${TTY_FD} ;;
    esac
  done
}

validate_hostname() {
  local value="$1"
  if [[ ${#value} -gt 63 || ! "${value}" =~ ^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]]; then
    printf '%bUse 1–63 letters, numbers, or hyphens; start and end with a letter or number.%b\n' "${YELLOW}" "${RESET}" >&${TTY_FD}
    return 1
  fi
}

validate_cidr() {
  local value="$1"
  if [[ "${value}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$ || "${value}" =~ ^[0-9A-Fa-f:]+/([0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$ ]]; then
    return 0
  fi
  printf '%bEnter an IPv4 or IPv6 CIDR, such as 192.168.1.0/24.%b\n' "${YELLOW}" "${RESET}" >&${TTY_FD}
  return 1
}

profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES:-}," == *",${profile},"* ]]
}

add_profile() {
  local profile="$1"
  if ! profile_enabled "${profile}"; then
    TAILHOME_PROFILES="${TAILHOME_PROFILES:+${TAILHOME_PROFILES},}${profile}"
  fi
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
}

wait_for_tailscaled() {
  local attempts="${TAILHOME_TAILSCALE_READY_ATTEMPTS:-12}"
  local delay="${TAILHOME_TAILSCALE_READY_DELAY:-5}"
  local attempt=1
  local output="" backend=""

  [[ "${attempts}" =~ ^[1-9][0-9]*$ ]] || attempts=12
  [[ "${delay}" =~ ^[0-9]+$ ]] || delay=5
  TAILSCALE_READINESS_CYCLES=$((TAILSCALE_READINESS_CYCLES + 1))

  while [[ "${attempt}" -le "${attempts}" ]]; do
    if output="$(${SUDO} tailscale status --json 2>&1)"; then
      :
    fi
    backend="$(printf '%s' "${output}" | sed -n 's/.*"BackendState"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
    case "${backend}" in
      Running)
        TAILSCALE_DAEMON_STATE="connected"
        return 0
        ;;
      NeedsLogin)
        TAILSCALE_DAEMON_STATE="needs-login"
        return 0
        ;;
      Stopped|NoState)
        TAILSCALE_DAEMON_STATE="unhealthy"
        TAILSCALE_DIAGNOSTIC="tailscaled backend state: ${backend}"
        return 1
        ;;
    esac
    if [[ -n "${output}" ]]; then
      TAILSCALE_DIAGNOSTIC="$(printf '%s\n' "${output}" | head -n 1 | cut -c1-240)"
    fi
    if [[ "${attempt}" -lt "${attempts}" ]]; then
      sleep "${delay}"
    fi
    attempt=$((attempt + 1))
  done

  return 1
}

attempt_tailscale_connection() {
  local output="" backend=""
  local -a tailscale_args=(up --ssh)

  if [[ "${TAILHOME_ENABLE_EXIT_NODE:-0}" == "1" ]]; then
    tailscale_args+=(--advertise-exit-node)
  fi

  if [[ -n "${TAILHOME_SUBNET_ROUTES:-}" ]]; then
    tailscale_args+=(--advertise-routes="${TAILHOME_SUBNET_ROUTES}")
  fi

  if ! command -v tailscale >/dev/null 2>&1; then
    TAILSCALE_DIAGNOSTIC="tailscale command is unavailable"
    return 0
  fi

  if ! wait_for_tailscaled; then
    return 0
  fi

  if [[ "${TAILSCALE_DAEMON_STATE}" == "connected" ]]; then
    TAILSCALE_CONNECTION_STATE="connected"
    return 0
  fi

  if [[ "${TAILSCALE_DAEMON_STATE}" == "needs-login" ]]; then
    local login_timeout="${TAILHOME_TAILSCALE_LOGIN_TIMEOUT:-180}"
    local up_status=0

    [[ "${login_timeout}" =~ ^[1-9][0-9]*$ ]] || login_timeout=180
    log "Complete Tailscale login in your browser when prompted. Setup continues after ${login_timeout}s if login is unfinished."

    # Stream AuthURL to the TTY; never capture output (that hides the login link and looks hung).
    # Prefer process-group timeout (no --foreground) so child processes are killed on expiry.
    if command -v timeout >/dev/null 2>&1; then
      ${SUDO} timeout "${login_timeout}" tailscale "${tailscale_args[@]}" || up_status=$?
    else
      ${SUDO} tailscale "${tailscale_args[@]}" || up_status=$?
    fi

    if [[ "${up_status}" -ne 0 ]]; then
      if [[ "${up_status}" -eq 124 ]]; then
        TAILSCALE_DIAGNOSTIC="Tailscale login timed out after ${login_timeout}s; run tailhome connect"
      else
        TAILSCALE_DIAGNOSTIC="tailscale up failed (exit ${up_status})"
      fi
      return 0
    fi

    if output="$(${SUDO} tailscale status --json 2>&1)"; then
      backend="$(printf '%s' "${output}" | sed -n 's/.*"BackendState"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
      if [[ "${backend}" == "Running" ]]; then
        TAILSCALE_CONNECTION_STATE="connected"
      else
        TAILSCALE_DIAGNOSTIC="authentication has not completed"
      fi
    else
      TAILSCALE_DIAGNOSTIC="authentication has not completed"
    fi
  fi
  return 0
}

choose_profile() {
  local profile="$1"
  local label="$2"
  local default_answer

  if profile_enabled "${profile}"; then
    default_answer="yes"
  else
    default_answer="no"
  fi

  if prompt_yes_no "${label}" "${default_answer}"; then
    add_profile "${profile}"
  else
    remove_profile "${profile}"
  fi
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
      *) fail "unknown service profile: ${profile}" ;;
    esac
    if [[ ",${normalized}," != *",${profile},"* ]]; then
      normalized="${normalized:+${normalized},}${profile}"
    fi
  done
  TAILHOME_PROFILES="${normalized}"
  export TAILHOME_PROFILES
}

selected_services() {
  local services="Homepage, Caddy"
  profile_enabled monitoring && services="${services}, Grafana, Prometheus, Node Exporter"
  profile_enabled uptime && services="${services}, Uptime Kuma"
  profile_enabled management && services="${services}, Portainer"
  profile_enabled dns && services="${services}, Pi-hole"
  printf '%s' "${services}"
}

existing_profiles() {
  local env_file="${TAILHOME_DIR:-/opt/tailhome}/.env"

  [[ -f "${env_file}" ]] || return 1
  awk -F= '$1 == "COMPOSE_PROFILES" { print substr($0, index($0, "=") + 1); exit }' "${env_file}" 2>/dev/null || true
}

initial_profiles() {
  if existing_profiles; then
    return 0
  fi
  printf '%s' "${DEFAULT_TAILHOME_PROFILES}"
}

onboard() {
  local os_name arch_name start_label

  banner
  os_name="$(. /etc/os-release 2>/dev/null; printf '%s' "${PRETTY_NAME:-Linux}")"
  arch_name="$(uname -m)"
  printf '%bSystem%b  %s · %s\n' "${MUTED}" "${RESET}" "${os_name}" "${arch_name}"
  printf '%bPlan%b    Install to %s\n\n' "${MUTED}" "${RESET}" "${TAILHOME_DIR:-/opt/tailhome}"

  prompt_value TAILHOME_HOSTNAME "Name this TailHome server" "${TAILHOME_HOSTNAME:-tailhome}" validate_hostname
  export TAILHOME_HOSTNAME

  if [[ "${SKIP_TAILSCALE_INSTALL}" -eq 0 ]] && ! command -v tailscale >/dev/null 2>&1; then
    if ! prompt_yes_no "Install Tailscale for private remote access?" yes; then
      SKIP_TAILSCALE_INSTALL=1
      SKIP_TAILSCALE_LOGIN=1
    fi
  fi

  if [[ "${SKIP_TAILSCALE_LOGIN}" -eq 0 ]]; then
    if ! prompt_yes_no "Connect this server to Tailscale during setup?" yes; then
      SKIP_TAILSCALE_LOGIN=1
    fi
  fi

  if [[ "${SKIP_TAILSCALE_LOGIN}" -eq 0 ]]; then
    if [[ -n "${TAILHOME_SUBNET_ROUTES:-}" ]] || prompt_yes_no "Advertise your home subnet through TailHome?" no; then
      prompt_value TAILHOME_SUBNET_ROUTES "Home subnet CIDR" "${TAILHOME_SUBNET_ROUTES:-192.168.1.0/24}" validate_cidr
      export TAILHOME_SUBNET_ROUTES
    fi

    if prompt_yes_no "Use this server as a Tailscale exit node?" "$( [[ "${TAILHOME_ENABLE_EXIT_NODE:-0}" == "1" ]] && printf yes || printf no )"; then
      TAILHOME_ENABLE_EXIT_NODE=1
    else
      TAILHOME_ENABLE_EXIT_NODE=0
    fi
    export TAILHOME_ENABLE_EXIT_NODE
  fi

  if [[ "${SKIP_DOCKER_INSTALL}" -eq 0 ]] && ! command -v docker >/dev/null 2>&1; then
    prompt_yes_no "Install Docker and Docker Compose?" yes || fail "Docker is required for the TailHome service stack"
  fi

  if [[ "${PROFILES_PRESET}" -eq 0 ]]; then
    printf '\n%bChoose service profiles%b\n' "${BOLD}" "${RESET}"
    printf '  Core includes Homepage and Caddy. Profile groups are enabled by default on fresh installs.\n\n'
    choose_profile monitoring "Add monitoring: Grafana, Prometheus, and Node Exporter? (~1.9 GB)"
    choose_profile uptime "Add Uptime Kuma? (~724 MB)"
    choose_profile management "Add Portainer? (~187 MB)"
    choose_profile dns "Add Pi-hole DNS? (requires exclusive port 53)"
    export TAILHOME_PROFILES
  fi

  if [[ "${NO_START}" -eq 0 ]]; then
    start_label="Start the TailHome services after setup?"
    if prompt_yes_no "${start_label}" yes; then
      NO_START=0
    else
      NO_START=1
    fi
  fi

  printf '\n%bReady to install%b\n' "${BOLD}" "${RESET}"
  printf '  Server name      %s\n' "${TAILHOME_HOSTNAME}"
  printf '  Install folder   %s\n' "${TAILHOME_DIR:-/opt/tailhome}"
  printf '  Tailscale        %s\n' "$( [[ "${SKIP_TAILSCALE_INSTALL}" -eq 0 ]] && printf enabled || printf skipped )"
  printf '  Subnet route     %s\n' "${TAILHOME_SUBNET_ROUTES:-not advertised}"
  printf '  Exit node        %s\n' "$( [[ "${TAILHOME_ENABLE_EXIT_NODE:-0}" == "1" ]] && printf enabled || printf disabled )"
  printf '  Services         %s\n' "$(selected_services)"
  printf '  Start services   %s\n\n' "$( [[ "${NO_START}" -eq 0 ]] && printf yes || printf no )"

  prompt_yes_no "Continue with this setup?" yes || {
    printf 'No changes were made.\n'
    exit 0
  }
}

SKIP_TAILSCALE_INSTALL=0
SKIP_TAILSCALE_LOGIN=0
SKIP_DOCKER_INSTALL=0
NO_START=0
FORCE_NON_INTERACTIVE=0
if [[ -v TAILHOME_PROFILES ]]; then
  PROFILES_PRESET=1
else
  PROFILES_PRESET=0
  TAILHOME_PROFILES="$(initial_profiles)"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-tailscale-install)
      SKIP_TAILSCALE_INSTALL=1
      shift
      ;;
    --skip-tailscale-login)
      SKIP_TAILSCALE_LOGIN=1
      shift
      ;;
    --skip-docker-install)
      SKIP_DOCKER_INSTALL=1
      shift
      ;;
    --no-start)
      NO_START=1
      shift
      ;;
    --non-interactive|-y|--yes)
      FORCE_NON_INTERACTIVE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

normalize_profiles

if [[ "$(uname -s)" != "Linux" ]]; then
  fail "TailHome currently supports Linux only."
fi

if [[ "${FORCE_NON_INTERACTIVE}" -eq 0 && "${TAILHOME_INTERACTIVE:-1}" != "0" ]]; then
  if { exec 3<>/dev/tty; } 2>/dev/null; then
    INTERACTIVE=1
  fi
fi

if [[ "${INTERACTIVE}" -eq 1 ]]; then
  onboard
else
  log "TailHome ${TAILHOME_VERSION} non-interactive installation"
fi

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" ]]; then
  SUDO=""
elif [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null 2>&1 || fail "sudo is required when not running as root."
  SUDO="sudo"
fi

step "Checking this server"
"${SCRIPT_DIR}/scripts/check-system.sh"

TAILSCALE_CONNECTION_STATE="pending"
TAILSCALE_DAEMON_STATE="unavailable"
TAILSCALE_DIAGNOSTIC=""
TAILSCALE_READINESS_CYCLES=0

step "Setting up Tailscale"
if [[ "${SKIP_TAILSCALE_INSTALL}" -eq 0 ]]; then
  if ! tailscale_install_output="$("${SCRIPT_DIR}/scripts/install-tailscale.sh" 2>&1)"; then
    TAILSCALE_DIAGNOSTIC="$(printf '%s\n' "${tailscale_install_output:-Tailscale installation failed}" | head -n 1 | cut -c1-240)"
  fi
fi

if [[ "${SKIP_TAILSCALE_LOGIN}" -eq 0 ]]; then
  attempt_tailscale_connection
fi

step "Setting up Docker"
if [[ "${SKIP_DOCKER_INSTALL}" -eq 0 ]]; then
  "${SCRIPT_DIR}/scripts/install-docker.sh"
else
  warn "skipping Docker install as requested"
fi

step "Creating the TailHome stack"
if [[ "${NO_START}" -eq 1 ]]; then
  export TAILHOME_NO_START=1
fi
"${SCRIPT_DIR}/scripts/setup-stack.sh"

if [[ -n "${TAILSCALE_DIAGNOSTIC}" ]]; then
  printf '%s\n' "${TAILSCALE_DIAGNOSTIC}" | ${SUDO} tee "${TAILHOME_DIR:-/opt/tailhome}/.tailscale-diagnostic" >/dev/null
  ${SUDO} chmod 600 "${TAILHOME_DIR:-/opt/tailhome}/.tailscale-diagnostic"
else
  ${SUDO} rm -f -- "${TAILHOME_DIR:-/opt/tailhome}/.tailscale-diagnostic"
fi

step "Finishing setup"
if [[ "${NO_START}" -eq 0 ]]; then
  "${SCRIPT_DIR}/scripts/health-check.sh" || warn "health check reported issues; run 'tailhome status' after services finish starting"
else
  warn "skipping health check because --no-start was used"
fi

summary_env_value() {
  local name="$1"
  local fallback="$2"
  local value
  value="$(${SUDO} awk -F= -v name="${name}" '$1 == name { print substr($0, index($0, "=") + 1); exit }' "${TAILHOME_DIR:-/opt/tailhome}/.env" 2>/dev/null || true)"
  printf '%s' "${value:-${fallback}}"
}

summary_profile_enabled() {
  [[ ",${SUMMARY_PROFILES}," == *",$1,"* ]]
}

SUMMARY_HOSTNAME="$(summary_env_value TAILHOME_HOSTNAME tailhome)"
SUMMARY_PROFILES="$(summary_env_value COMPOSE_PROFILES '')"
SUMMARY_HOMEPAGE_PORT="$(summary_env_value TAILHOME_HOMEPAGE_PORT 3000)"
SUMMARY_GRAFANA_PORT="$(summary_env_value TAILHOME_GRAFANA_PORT 3001)"
SUMMARY_UPTIME_PORT="$(summary_env_value TAILHOME_UPTIME_PORT 3002)"
SUMMARY_CADDY_HTTP_PORT="$(summary_env_value TAILHOME_CADDY_HTTP_PORT 8088)"
SUMMARY_PROMETHEUS_PORT="$(summary_env_value TAILHOME_PROMETHEUS_PORT 9090)"
SUMMARY_PORTAINER_PORT="$(summary_env_value TAILHOME_PORTAINER_PORT 9443)"
SUMMARY_PIHOLE_WEB_PORT="$(summary_env_value TAILHOME_PIHOLE_WEB_PORT 8080)"

printf '\n%b✓ TailHome is ready%b\n\n' "${GREEN}${BOLD}" "${RESET}"
printf '%bServices%b\n' "${BOLD}" "${RESET}"
printf '  %-13s http://%s:%s\n' "Homepage" "${SUMMARY_HOSTNAME}" "${SUMMARY_HOMEPAGE_PORT}"
printf '  %-13s http://%s:%s\n' "Caddy" "${SUMMARY_HOSTNAME}" "${SUMMARY_CADDY_HTTP_PORT}"
if summary_profile_enabled monitoring; then
  printf '  %-13s http://%s:%s\n' "Grafana" "${SUMMARY_HOSTNAME}" "${SUMMARY_GRAFANA_PORT}"
  printf '  %-13s http://%s:%s\n' "Prometheus" "${SUMMARY_HOSTNAME}" "${SUMMARY_PROMETHEUS_PORT}"
fi
summary_profile_enabled uptime && printf '  %-13s http://%s:%s\n' "Uptime Kuma" "${SUMMARY_HOSTNAME}" "${SUMMARY_UPTIME_PORT}"
summary_profile_enabled management && printf '  %-13s https://%s:%s\n' "Portainer" "${SUMMARY_HOSTNAME}" "${SUMMARY_PORTAINER_PORT}"
summary_profile_enabled dns && printf '  %-13s http://%s:%s/admin\n' "Pi-hole" "${SUMMARY_HOSTNAME}" "${SUMMARY_PIHOLE_WEB_PORT}"

if ${SUDO} test -s "${TAILHOME_DIR:-/opt/tailhome}/.port-adjustments"; then
  printf '\n%bAutomatically adjusted%b\n' "${BOLD}" "${RESET}"
  while IFS='|' read -r label preferred resolved; do
    [[ -n "${label}" ]] || continue
    printf '  %-13s %s -> %s\n' "${label}" "${preferred}" "${resolved}"
  done < <(${SUDO} cat "${TAILHOME_DIR:-/opt/tailhome}/.port-adjustments")
fi

if ${SUDO} test -f "${TAILHOME_DIR:-/opt/tailhome}/.dns-port-blocked"; then
  cat <<'MSG'

Pi-hole DNS was not started because port 53 is occupied.
Free port 53, then run:
  tailhome enable dns
MSG
elif ${SUDO} test -f "${TAILHOME_DIR:-/opt/tailhome}/.dns-start-failed"; then
  cat <<'MSG'

Pi-hole DNS did not start; every other selected service is available.
Review the saved diagnostic, then retry with:
  tailhome enable dns
MSG
fi

printf '\nTailscale     %s\n' "$( [[ "${TAILSCALE_CONNECTION_STATE}" == "connected" ]] && printf connected || printf 'connection pending' )"
if [[ "${TAILSCALE_CONNECTION_STATE}" != "connected" ]]; then
  if [[ "${NO_START}" -eq 0 ]]; then
    printf 'Local services are running.\n'
  else
    printf 'The local service configuration is ready.\n'
  fi
  printf 'Complete private access with:\n  tailhome connect\n'
fi
