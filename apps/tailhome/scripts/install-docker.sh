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

if command -v docker >/dev/null 2>&1; then
  printf 'Docker is already installed.\n'
else
  command -v curl >/dev/null 2>&1 || {
    ${SUDO} apt-get update
    ${SUDO} apt-get install -y curl ca-certificates
  }

  curl -fsSL https://get.docker.com | sh
fi

if command -v systemctl >/dev/null 2>&1; then
  ${SUDO} systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  ${SUDO} apt-get update
  ${SUDO} apt-get install -y docker-compose-plugin
fi

if [[ -n "${SUDO}" && -n "${USER:-}" && "${USER}" != "root" ]]; then
  ${SUDO} usermod -aG docker "${USER}" || true
  printf 'Added %s to the docker group. You may need to log out and back in.\n' "${USER}"
fi

printf 'Docker install step complete.\n'
