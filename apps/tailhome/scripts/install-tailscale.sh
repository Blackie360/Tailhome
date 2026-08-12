#!/usr/bin/env bash
set -Eeuo pipefail

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

warn() {
  printf 'warning: %s\n' "$*" >&2
}

tailscaled_is_ready() {
  command -v tailscale >/dev/null 2>&1 || return 1
  ${SUDO} tailscale status --json >/dev/null 2>&1 || ${SUDO} tailscale status >/dev/null 2>&1
}

wait_for_tailscaled() {
  local attempts="${TAILHOME_TAILSCALE_READY_ATTEMPTS:-12}"
  local delay="${TAILHOME_TAILSCALE_READY_DELAY:-5}"
  local attempt=1

  [[ "${attempts}" =~ ^[1-9][0-9]*$ ]] || attempts=12
  [[ "${delay}" =~ ^[0-9]+$ ]] || delay=5

  while [[ "${attempt}" -le "${attempts}" ]]; do
    if tailscaled_is_ready; then
      printf 'tailscaled is ready.\n'
      return 0
    fi

    if [[ "${attempt}" -lt "${attempts}" ]]; then
      printf 'Waiting for tailscaled to become ready (attempt %s/%s); retrying in %ss...\n' "${attempt}" "${attempts}" "${delay}"
      sleep "${delay}"
    fi
    attempt=$((attempt + 1))
  done

  return 1
}

if command -v tailscale >/dev/null 2>&1; then
  printf 'Tailscale is already installed.\n'
else
  command -v curl >/dev/null 2>&1 || {
    ${SUDO} apt-get update
    ${SUDO} apt-get install -y curl ca-certificates
  }

  curl -fsSL https://tailscale.com/install.sh | sh
fi

if command -v systemctl >/dev/null 2>&1; then
  if ! ${SUDO} systemctl enable --now tailscaled; then
    warn "could not enable/start tailscaled with systemctl; Tailscale login may need to be completed later"
  fi
fi

if ! wait_for_tailscaled; then
  warn "tailscaled did not become ready within the installer timeout; continuing so Docker and TailHome can still be installed"
  warn "finish Tailscale later with: sudo systemctl start tailscaled && sudo tailscale up"
fi

printf 'Tailscale install step complete.\n'
