#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAILHOME_DIR="${TAILHOME_DIR:-/opt/tailhome}"
TAILHOME_HOSTNAME="${TAILHOME_HOSTNAME:-tailhome}"
TAILHOME_BIN_DIR="${TAILHOME_BIN_DIR:-/usr/local/bin}"

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

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '\n'
  else
    date +%s%N | sha256sum | awk '{print $1}'
  fi
}

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
TAILHOME_GRAFANA_USER=admin
TAILHOME_GRAFANA_PASSWORD=${grafana_password}
TAILHOME_PIHOLE_PASSWORD=${pihole_password}
ENV
fi

${SUDO} mkdir -p "${TAILHOME_BIN_DIR}"

if [[ ! -f "${TAILHOME_BIN_DIR}/tailhome" ]]; then
  ${SUDO} cp "${PROJECT_DIR}/bin/tailhome" "${TAILHOME_BIN_DIR}/tailhome"
  ${SUDO} chmod +x "${TAILHOME_BIN_DIR}/tailhome"
else
  ${SUDO} cp "${PROJECT_DIR}/bin/tailhome" "${TAILHOME_BIN_DIR}/tailhome"
fi

${SUDO} chmod +x "${TAILHOME_BIN_DIR}/tailhome"

cd "${TAILHOME_DIR}"
if [[ "${TAILHOME_NO_START:-0}" == "1" ]]; then
  docker compose config >/dev/null
  printf 'TailHome stack rendered successfully. Skipping container start.\n'
else
  ${SUDO} docker compose pull
  ${SUDO} docker compose up -d
fi

printf 'TailHome stack created at %s.\n' "${TAILHOME_DIR}"
