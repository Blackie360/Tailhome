#!/usr/bin/env bash
set -uo pipefail

if [[ "${TAILHOME_USE_SUDO:-1}" == "0" || "${EUID}" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null 2>&1 || {
    printf 'sudo is required to install Tailscale\n' >&2
    exit 1
  }
  SUDO="sudo"
fi

SYSTEMD_ROOT="${TAILHOME_SYSTEMD_DIR:-/etc/systemd/system}"
DROP_IN_DIR="${SYSTEMD_ROOT}/tailscaled.service.d"
DROP_IN_FILE="${DROP_IN_DIR}/override.conf"

install_tailscale() {
  if command -v tailscale >/dev/null 2>&1; then
    return 0
  fi

  if ! command -v curl >/dev/null 2>&1; then
    ${SUDO} apt-get update >/dev/null 2>&1 || return 1
    ${SUDO} apt-get install -y curl ca-certificates >/dev/null 2>&1 || return 1
  fi
  curl -fsSL https://tailscale.com/install.sh | ${SUDO} sh >/dev/null 2>&1
}

write_restart_drop_in() {
  local temporary
  temporary="$(mktemp)" || return 1
  cat > "${temporary}" <<'UNIT'
[Unit]
StartLimitIntervalSec=0

[Service]
Restart=always
RestartSec=5s
UNIT
  ${SUDO} mkdir -p "${DROP_IN_DIR}" >/dev/null 2>&1 || {
    rm -f -- "${temporary}"
    return 1
  }
  ${SUDO} cp "${temporary}" "${DROP_IN_FILE}" >/dev/null 2>&1
  status=$?
  rm -f -- "${temporary}"
  return "${status}"
}

install_tailscale || {
  printf 'Tailscale package installation failed\n' >&2
  exit 1
}

if command -v systemctl >/dev/null 2>&1; then
  write_restart_drop_in || {
    printf 'could not write the tailscaled restart policy\n' >&2
    exit 1
  }
  ${SUDO} systemctl daemon-reload >/dev/null 2>&1 || {
    printf 'could not reload systemd after configuring tailscaled\n' >&2
    exit 1
  }
  ${SUDO} systemctl enable --now tailscaled >/dev/null 2>&1 || {
    printf 'could not enable and start tailscaled\n' >&2
    exit 1
  }
fi

exit 0
