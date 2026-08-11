#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/apps/tailhome"
PUBLIC_DIR="${ROOT_DIR}/apps/web/public"
DOWNLOAD_DIR="${PUBLIC_DIR}/downloads"
WORK_DIR="$(mktemp -d)"
BASE_DIR="${WORK_DIR}/base/tailhome"
BUILD_DIR="${WORK_DIR}/dist"

cleanup() {
  rm -rf -- "${WORK_DIR}"
}
trap cleanup EXIT

command -v go >/dev/null 2>&1 || {
  printf 'error: Go is required to build installer assets\n' >&2
  exit 1
}

mkdir -p "${BASE_DIR}" "${BUILD_DIR}" "${DOWNLOAD_DIR}"
cp "${APP_DIR}/install.sh" "${APP_DIR}/docker-compose.yml" "${APP_DIR}/go.mod" "${APP_DIR}/LICENSE" "${BASE_DIR}/"
cp -R "${APP_DIR}/cmd" "${APP_DIR}/configs" "${APP_DIR}/scripts" "${BASE_DIR}/"

build_cli() {
  local goos="$1"
  local goarch="$2"
  local goarm="$3"
  local asset="$4"

  printf 'Building %s\n' "${asset}"
  if [[ -n "${goarm}" ]]; then
    (
      cd "${APP_DIR}"
      CGO_ENABLED=0 GOOS="${goos}" GOARCH="${goarch}" GOARM="${goarm}" \
        go build -trimpath -ldflags="-s -w" -o "${BUILD_DIR}/${asset}" ./cmd/tailhome
    )
  else
    (
      cd "${APP_DIR}"
      CGO_ENABLED=0 GOOS="${goos}" GOARCH="${goarch}" \
        go build -trimpath -ldflags="-s -w" -o "${BUILD_DIR}/${asset}" ./cmd/tailhome
    )
  fi
}

package_bundle() {
  local asset="$1"
  local package_root="${WORK_DIR}/packages/${asset}"
  local archive="${DOWNLOAD_DIR}/${asset}.tar.gz"

  mkdir -p "${package_root}/tailhome/dist"
  cp -R "${BASE_DIR}/." "${package_root}/tailhome/"
  cp "${BUILD_DIR}/${asset}" "${package_root}/tailhome/dist/${asset}"
  chmod +x "${package_root}/tailhome/install.sh" "${package_root}/tailhome"/scripts/*.sh "${package_root}/tailhome/dist/${asset}"

  tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -czf "${archive}" -C "${package_root}" tailhome
  (
    cd "${DOWNLOAD_DIR}"
    sha256sum "${asset}.tar.gz" > "${asset}.tar.gz.sha256"
  )
}

assets=(
  tailhome-linux-amd64
  tailhome-linux-arm64
  tailhome-linux-armv7
  tailhome-linux-armv6
  tailhome-darwin-amd64
  tailhome-darwin-arm64
  tailhome-windows-amd64.exe
  tailhome-windows-arm64.exe
)

build_cli linux amd64 "" tailhome-linux-amd64
build_cli linux arm64 "" tailhome-linux-arm64
build_cli linux arm 7 tailhome-linux-armv7
build_cli linux arm 6 tailhome-linux-armv6
build_cli darwin amd64 "" tailhome-darwin-amd64
build_cli darwin arm64 "" tailhome-darwin-arm64
build_cli windows amd64 "" tailhome-windows-amd64.exe
build_cli windows arm64 "" tailhome-windows-arm64.exe

for asset in "${assets[@]}"; do
  package_bundle "${asset}"
done

# PowerShell installs the Windows executable directly.
for asset in tailhome-windows-amd64.exe tailhome-windows-arm64.exe; do
  cp "${BUILD_DIR}/${asset}" "${DOWNLOAD_DIR}/${asset}"
  (
    cd "${DOWNLOAD_DIR}"
    sha256sum "${asset}" > "${asset}.sha256"
  )
done

# Remove the obsolete all-platform bundle after platform bundles are ready.
rm -f -- "${PUBLIC_DIR}/tailhome.tar.gz" "${PUBLIC_DIR}/tailhome.tar.gz.sha256"
cp "${ROOT_DIR}/install.sh" "${PUBLIC_DIR}/install.sh"
cp "${ROOT_DIR}/install.ps1" "${PUBLIC_DIR}/install.ps1"

printf 'Installer assets written to %s\n' "${PUBLIC_DIR}"
du -h "${DOWNLOAD_DIR}"/*.tar.gz | sort -h
