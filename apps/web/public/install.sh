#!/usr/bin/env bash
set -Eeuo pipefail

TAILHOME_VERSION="0.1.0"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_INSTALLER="${ROOT_DIR}/apps/tailhome/install.sh"
INSTALL_MODE="${TAILHOME_INSTALL_MODE:-full}"

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<USAGE
TailHome ${TAILHOME_VERSION}

Usage:
  ./install.sh [--cli-only] [installer options]

Modes:
  full       Linux only. Installs Tailscale, Docker, the TailHome stack, and the CLI.
  cli-only   Installs only the tailhome CLI binary.

Environment:
  TAILHOME_INSTALL_MODE=full|cli-only
  TAILHOME_INSTALL_VERSION=main-latest
  TAILHOME_BIN_DIR=/usr/local/bin
  TAILHOME_CLI_URL=https://example.com/tailhome-linux-arm64
USAGE
}

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

detect_os() {
  case "$(uname -s)" in
    Linux) printf 'linux' ;;
    Darwin) printf 'darwin' ;;
    MINGW*|MSYS*|CYGWIN*) printf 'windows' ;;
    *) fail "unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'amd64' ;;
    arm64|aarch64) printf 'arm64' ;;
    armv7l) printf 'armv7' ;;
    armv6l) printf 'armv6' ;;
    *) fail "unsupported architecture: $(uname -m)" ;;
  esac
}

install_cli() {
  os_name="$(detect_os)"
  arch="$(detect_arch)"
  version="${TAILHOME_INSTALL_VERSION:-main-latest}"
  extension=""

  if [[ "${os_name}" == "windows" ]]; then
    extension=".exe"
    bin_dir="${TAILHOME_BIN_DIR:-${HOME}/bin}"
  else
    bin_dir="${TAILHOME_BIN_DIR:-/usr/local/bin}"
  fi

  asset="tailhome-${os_name}-${arch}${extension}"
  cli_url="${TAILHOME_CLI_URL:-https://github.com/${TAILHOME_INSTALL_REPO:-Blackie360/Tailhome}/releases/download/${version}/${asset}}"
  tmp_dir="$(mktemp -d)"
  tmp_bin="${tmp_dir}/${asset}"

  cleanup_cli() {
    rm -rf "${tmp_dir}"
  }
  trap cleanup_cli EXIT

  printf 'Downloading TailHome CLI from %s\n' "${cli_url}"
  download "${cli_url}" "${tmp_bin}"
  chmod +x "${tmp_bin}"

  if [[ "${os_name}" == "windows" ]]; then
    mkdir -p "${bin_dir}"
    cp "${tmp_bin}" "${bin_dir}/tailhome.exe"
    printf 'TailHome CLI installed at %s\n' "${bin_dir}/tailhome.exe"
    printf 'Add %s to PATH if it is not already available.\n' "${bin_dir}"
  else
    if [[ "${TAILHOME_USE_SUDO:-1}" == "0" || "${EUID}" -eq 0 ]]; then
      sudo_cmd=()
    else
      command -v sudo >/dev/null 2>&1 || fail "sudo is required to install to ${bin_dir}; set TAILHOME_BIN_DIR to a writable directory"
      sudo_cmd=(sudo)
    fi
    "${sudo_cmd[@]}" mkdir -p "${bin_dir}"
    "${sudo_cmd[@]}" cp "${tmp_bin}" "${bin_dir}/tailhome"
    "${sudo_cmd[@]}" chmod +x "${bin_dir}/tailhome"
    printf 'TailHome CLI installed at %s\n' "${bin_dir}/tailhome"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli-only)
      INSTALL_MODE="cli-only"
      shift
      ;;
    -h|--help)
      if [[ -x "${LOCAL_INSTALLER}" && "$(detect_os)" == "linux" ]]; then
        exec "${LOCAL_INSTALLER}" "$@"
      fi
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

if [[ "${INSTALL_MODE}" == "cli-only" || "$(detect_os)" != "linux" ]]; then
  install_cli
  exit 0
fi

if [[ -x "${LOCAL_INSTALLER}" ]]; then
  exec "${LOCAL_INSTALLER}" "$@"
fi

command -v tar >/dev/null 2>&1 || fail "tar is required"

REPO="${TAILHOME_INSTALL_REPO:-Blackie360/Tailhome}"
REF="${TAILHOME_INSTALL_REF:-${TAILHOME_INSTALL_VERSION:-main-latest}}"
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
