#!/usr/bin/env bash
set -Eeuo pipefail

fail() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

warn() {
  printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2
}

if [[ "$(uname -s)" != "Linux" ]]; then
  fail "Linux is required."
fi

if [[ ! -r /etc/os-release ]]; then
  fail "/etc/os-release not found; cannot identify OS."
fi

# shellcheck disable=SC1091
. /etc/os-release

case "${ID_LIKE:-} ${ID:-}" in
  *debian*|*ubuntu*|*raspbian*)
    ;;
  *)
    warn "TailHome is tested on Raspberry Pi OS, Debian, and Ubuntu. Detected: ${PRETTY_NAME:-unknown}."
    ;;
esac

if ! command -v systemctl >/dev/null 2>&1; then
  warn "systemd was not detected; service startup checks may be limited."
fi

arch="$(uname -m)"
case "${arch}" in
  x86_64|aarch64|armv7l|armv6l)
    ;;
  *)
    warn "architecture ${arch} may not be supported by every container image."
    ;;
esac

if command -v free >/dev/null 2>&1; then
  mem_mb="$(free -m | awk '/^Mem:/ {print $2}')"
  if [[ -n "${mem_mb}" && "${mem_mb}" -lt 900 ]]; then
    warn "less than 1 GB RAM detected; use fewer services on small Raspberry Pi models."
  fi
fi

if command -v df >/dev/null 2>&1; then
  avail_kb="$(df -Pk / | awk 'NR==2 {print $4}')"
  if [[ -n "${avail_kb}" && "${avail_kb}" -lt 5242880 ]]; then
    warn "less than 5 GB free disk space detected."
  fi
fi

printf 'System check complete.\n'
