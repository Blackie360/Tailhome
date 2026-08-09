#!/usr/bin/env bash
set -Eeuo pipefail

TAILHOME_VERSION="0.1.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() {
  printf '\033[1;34m==>\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
TailHome ${TAILHOME_VERSION}

Usage:
  ./install.sh [--skip-tailscale-install] [--skip-tailscale-login] [--skip-docker-install] [--no-start]

Environment:
  TAILHOME_DIR=/opt/tailhome
  TAILHOME_HOSTNAME=tailhome
  TAILHOME_ENABLE_EXIT_NODE=0
  TAILHOME_SUBNET_ROUTES=192.168.1.0/24
  TAILHOME_SKIP_PORT_CHECK=1
  TAILHOME_USE_SUDO=0
USAGE
}

SKIP_TAILSCALE_INSTALL=0
SKIP_TAILSCALE_LOGIN=0
SKIP_DOCKER_INSTALL=0
NO_START=0

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
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

if [[ "$(uname -s)" != "Linux" ]]; then
  fail "TailHome currently supports Linux only."
fi

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" ]]; then
  SUDO=""
elif [[ "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null 2>&1 || fail "sudo is required when not running as root."
  SUDO="sudo"
fi

log "Welcome to TailHome"
"${SCRIPT_DIR}/scripts/check-system.sh"

if [[ "${SKIP_TAILSCALE_INSTALL}" -eq 0 ]]; then
  log "Installing Tailscale"
  "${SCRIPT_DIR}/scripts/install-tailscale.sh"
else
  warn "skipping Tailscale install as requested"
fi

if [[ "${SKIP_TAILSCALE_LOGIN}" -eq 0 ]]; then
  log "Starting Tailscale login"
  tailscale_args=(up --ssh)

  if [[ "${TAILHOME_ENABLE_EXIT_NODE:-0}" == "1" ]]; then
    tailscale_args+=(--advertise-exit-node)
  fi

  if [[ -n "${TAILHOME_SUBNET_ROUTES:-}" ]]; then
    tailscale_args+=(--advertise-routes="${TAILHOME_SUBNET_ROUTES}")
  fi

  ${SUDO} tailscale "${tailscale_args[@]}"
else
  warn "skipping Tailscale login as requested"
fi

if [[ "${SKIP_DOCKER_INSTALL}" -eq 0 ]]; then
  log "Installing Docker"
  "${SCRIPT_DIR}/scripts/install-docker.sh"
else
  warn "skipping Docker install as requested"
fi

if [[ "${TAILHOME_SKIP_PORT_CHECK:-0}" != "1" ]]; then
  log "Checking required ports"
  "${SCRIPT_DIR}/scripts/check-ports.sh"
else
  warn "skipping port check as requested"
fi

log "Creating TailHome service stack"
if [[ "${NO_START}" -eq 1 ]]; then
  export TAILHOME_NO_START=1
fi
"${SCRIPT_DIR}/scripts/setup-stack.sh"

if [[ "${NO_START}" -eq 0 ]]; then
  log "Running health check"
  "${SCRIPT_DIR}/scripts/health-check.sh" || warn "health check reported issues; run 'tailhome status' after services finish starting"
else
  warn "skipping health check because --no-start was used"
fi

log "TailHome install complete"
if command -v tailhome >/dev/null 2>&1; then
  tailhome urls
else
  "${SCRIPT_DIR}/bin/tailhome" urls
fi
