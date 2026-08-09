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
  ${SUDO} systemctl enable --now tailscaled
fi

printf 'Tailscale install step complete.\n'
