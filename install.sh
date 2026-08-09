#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_INSTALLER="${ROOT_DIR}/apps/tailhome/install.sh"

if [[ -x "${LOCAL_INSTALLER}" ]]; then
  exec "${LOCAL_INSTALLER}" "$@"
fi

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

command -v tar >/dev/null 2>&1 || fail "tar is required"

download() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${url}" -o "${output}"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "${output}" "${url}"
  else
    fail "curl or wget is required"
  fi
}

REPO="${TAILHOME_INSTALL_REPO:-Blackie360/Tailhome}"
REF="${TAILHOME_INSTALL_REF:-main}"
ARCHIVE_URL="${TAILHOME_INSTALL_URL:-https://github.com/${REPO}/archive/${REF}.tar.gz}"
TMP_DIR="$(mktemp -d)"
ARCHIVE="${TMP_DIR}/tailhome.tar.gz"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

printf 'Downloading TailHome from %s\n' "${ARCHIVE_URL}"
download "${ARCHIVE_URL}" "${ARCHIVE}"
tar -xzf "${ARCHIVE}" -C "${TMP_DIR}"

REMOTE_INSTALLER="$(find "${TMP_DIR}" -mindepth 2 -maxdepth 4 -path '*/apps/tailhome/install.sh' -type f | head -n 1)"
[[ -n "${REMOTE_INSTALLER}" ]] || fail "apps/tailhome/install.sh was not found in downloaded archive"
chmod +x "${REMOTE_INSTALLER}"

"${REMOTE_INSTALLER}" "$@"
