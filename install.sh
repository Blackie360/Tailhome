#!/usr/bin/env bash
set -Eeuo pipefail

TAILHOME_VERSION="0.1.0"
TAILHOME_ORIGIN="${TAILHOME_ORIGIN:-https://tailhome.blackielabs.com}"
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
  TAILHOME_INSTALL_URL=https://example.com/tailhome-linux-amd64.tar.gz
  TAILHOME_DOWNLOAD_ATTEMPTS=5
  TAILHOME_BIN_DIR=/usr/local/bin
  TAILHOME_ORIGIN=https://tailhome.blackielabs.com
USAGE
}

download() {
  local url="$1"
  local output="$2"
  local attempts="${TAILHOME_DOWNLOAD_ATTEMPTS:-5}"
  local retry_delay="${TAILHOME_DOWNLOAD_RETRY_DELAY:-2}"
  local attempt=1
  local status=1
  local received=0
  local -a resume_args

  [[ "${attempts}" =~ ^[1-9][0-9]*$ ]] || fail "TAILHOME_DOWNLOAD_ATTEMPTS must be a positive integer"
  [[ "${retry_delay}" =~ ^[0-9]+$ ]] || fail "TAILHOME_DOWNLOAD_RETRY_DELAY must be a non-negative integer"

  while [[ "${attempt}" -le "${attempts}" ]]; do
    resume_args=()
    if [[ -s "${output}" ]]; then
      received="$(wc -c < "${output}" | tr -d ' ')"
      resume_args=(--continue-at -)
      printf 'Resuming download at byte %s (attempt %s/%s)\n' "${received}" "${attempt}" "${attempts}" >&2
    fi

    if command -v curl >/dev/null 2>&1; then
      if curl -fsSL --connect-timeout 15 "${resume_args[@]}" "${url}" -o "${output}"; then
        return 0
      else
        status=$?
      fi
      # Exit 33 means the server rejected resume. Start the next attempt cleanly.
      if [[ "${status}" -eq 33 ]]; then
        rm -f -- "${output}"
      fi
    elif command -v wget >/dev/null 2>&1; then
      if wget -q --tries=1 --timeout=30 --continue -O "${output}" "${url}"; then
        return 0
      else
        status=$?
      fi
    else
      fail "curl or wget is required"
    fi

    if [[ "${attempt}" -ge "${attempts}" ]]; then
      printf 'error: download failed after %s attempts: %s\n' "${attempts}" "${url}" >&2
      return "${status}"
    fi

    printf 'warning: download interrupted (exit %s); retrying in %ss\n' "${status}" "${retry_delay}" >&2
    sleep "${retry_delay}"
    attempt=$((attempt + 1))
  done
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

platform_asset() {
  local os_name arch extension

  os_name="$(detect_os)"
  arch="$(detect_arch)"
  extension=""
  if [[ "${os_name}" == "windows" ]]; then
    extension=".exe"
  fi
  printf 'tailhome-%s-%s%s' "${os_name}" "${arch}" "${extension}"
}

verify_bundle() {
  local archive="$1"
  local checksum_file="$2"
  local expected actual

  if [[ ! -s "${checksum_file}" ]] || ! command -v sha256sum >/dev/null 2>&1; then
    return
  fi

  expected="$(awk 'NR == 1 {print $1}' "${checksum_file}")"
  actual="$(sha256sum "${archive}" | awk '{print $1}')"
  [[ -n "${expected}" && "${expected}" == "${actual}" ]] || fail "TailHome bundle checksum verification failed"
}

download_bundle() {
  local destination="$1"
  local archive_url checksum_url checksum_file asset

  asset="$(platform_asset)"
  archive_url="${TAILHOME_INSTALL_URL:-${TAILHOME_ORIGIN}/downloads/${asset}.tar.gz}"
  checksum_url="${TAILHOME_INSTALL_CHECKSUM_URL:-${archive_url}.sha256}"
  checksum_file="${destination}.sha256"

  printf 'Downloading TailHome from %s\n' "${archive_url}"
  download "${archive_url}" "${destination}"
  if download "${checksum_url}" "${checksum_file}" 2>/dev/null; then
    verify_bundle "${destination}" "${checksum_file}"
  else
    printf 'warning: checksum file was unavailable; continuing with the HTTPS download\n' >&2
  fi
}

extract_bundle() {
  local archive="$1"
  local destination="$2"
  local entry

  while IFS= read -r entry; do
    case "${entry}" in
      /*|../*|*/../*|*/..)
        fail "unsafe path in TailHome bundle: ${entry}"
        ;;
    esac
  done < <(tar -tzf "${archive}")

  tar -xzf "${archive}" -C "${destination}"
}

install_cli_from_bundle() {
  local bundle_root="$1"
  local os_name arch asset source_bin bin_dir
  local -a sudo_cmd

  os_name="$(detect_os)"
  arch="$(detect_arch)"
  if [[ "${os_name}" == "windows" ]]; then
    bin_dir="${TAILHOME_BIN_DIR:-${HOME}/bin}"
  else
    bin_dir="${TAILHOME_BIN_DIR:-/usr/local/bin}"
  fi

  asset="$(platform_asset)"
  source_bin="${bundle_root}/dist/${asset}"
  [[ -x "${source_bin}" || -f "${source_bin}" ]] || fail "the bundle does not contain a CLI for ${os_name}/${arch}"

  if [[ "${os_name}" == "windows" ]]; then
    mkdir -p "${bin_dir}"
    cp "${source_bin}" "${bin_dir}/tailhome.exe"
    chmod +x "${bin_dir}/tailhome.exe" 2>/dev/null || true
    printf 'TailHome CLI installed at %s\n' "${bin_dir}/tailhome.exe"
    printf 'Add %s to PATH if it is not already available.\n' "${bin_dir}"
    return
  fi

  if [[ "${TAILHOME_USE_SUDO:-1}" == "0" || "${EUID}" -eq 0 ]]; then
    sudo_cmd=()
  else
    command -v sudo >/dev/null 2>&1 || fail "sudo is required to install to ${bin_dir}; set TAILHOME_BIN_DIR to a writable directory"
    sudo_cmd=(sudo)
  fi

  "${sudo_cmd[@]}" mkdir -p "${bin_dir}"
  "${sudo_cmd[@]}" cp "${source_bin}" "${bin_dir}/tailhome"
  "${sudo_cmd[@]}" chmod +x "${bin_dir}/tailhome"
  printf 'TailHome CLI installed at %s\n' "${bin_dir}/tailhome"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cli-only)
      INSTALL_MODE="cli-only"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

command -v tar >/dev/null 2>&1 || fail "tar is required"

# BASH_SOURCE is empty when this script is streamed with `curl | bash`.
# Only resolve a checkout-relative installer when a real source file exists.
SCRIPT_SOURCE="${BASH_SOURCE[0]-}"
LOCAL_INSTALLER=""
if [[ -n "${SCRIPT_SOURCE}" && -f "${SCRIPT_SOURCE}" ]]; then
  ROOT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
  if [[ -x "${ROOT_DIR}/apps/tailhome/install.sh" ]]; then
    LOCAL_INSTALLER="${ROOT_DIR}/apps/tailhome/install.sh"
  fi
fi

if [[ "${INSTALL_MODE}" == "full" && "$(detect_os)" == "linux" && -n "${LOCAL_INSTALLER}" ]]; then
  exec "${LOCAL_INSTALLER}" "$@"
fi

TMP_DIR="$(mktemp -d)"
ARCHIVE="${TMP_DIR}/tailhome.tar.gz"

cleanup() {
  rm -rf -- "${TMP_DIR}"
}
trap cleanup EXIT

download_bundle "${ARCHIVE}"
extract_bundle "${ARCHIVE}" "${TMP_DIR}"

BUNDLE_ROOT="${TMP_DIR}/tailhome"
[[ -d "${BUNDLE_ROOT}" ]] || fail "the downloaded bundle is missing its tailhome directory"

if [[ "${INSTALL_MODE}" == "cli-only" || "$(detect_os)" != "linux" ]]; then
  install_cli_from_bundle "${BUNDLE_ROOT}"
  exit 0
fi

REMOTE_INSTALLER="${BUNDLE_ROOT}/install.sh"
[[ -f "${REMOTE_INSTALLER}" ]] || fail "install.sh was not found in the downloaded bundle"
chmod +x "${REMOTE_INSTALLER}"
"${REMOTE_INSTALLER}" "$@"
