#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/apps/tailhome"
PUBLIC_DIR="${ROOT_DIR}/apps/web/public"
WORK_DIR="$(mktemp -d)"
BUNDLE_DIR="${WORK_DIR}/tailhome"

cleanup() {
  rm -rf -- "${WORK_DIR}"
}
trap cleanup EXIT

command -v go >/dev/null 2>&1 || {
  printf 'error: Go is required to build installer assets\n' >&2
  exit 1
}

mkdir -p "${BUNDLE_DIR}/dist" "${PUBLIC_DIR}/downloads"
cp "${APP_DIR}/install.sh" "${APP_DIR}/docker-compose.yml" "${APP_DIR}/go.mod" "${APP_DIR}/LICENSE" "${BUNDLE_DIR}/"
cp -R "${APP_DIR}/cmd" "${APP_DIR}/configs" "${APP_DIR}/scripts" "${BUNDLE_DIR}/"

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
        go build -trimpath -ldflags="-s -w" -o "${BUNDLE_DIR}/dist/${asset}" ./cmd/tailhome
    )
  else
    (
      cd "${APP_DIR}"
      CGO_ENABLED=0 GOOS="${goos}" GOARCH="${goarch}" \
        go build -trimpath -ldflags="-s -w" -o "${BUNDLE_DIR}/dist/${asset}" ./cmd/tailhome
    )
  fi
}

build_cli linux amd64 "" tailhome-linux-amd64
build_cli linux arm64 "" tailhome-linux-arm64
build_cli linux arm 7 tailhome-linux-armv7
build_cli linux arm 6 tailhome-linux-armv6
build_cli darwin amd64 "" tailhome-darwin-amd64
build_cli darwin arm64 "" tailhome-darwin-arm64
build_cli windows amd64 "" tailhome-windows-amd64.exe
build_cli windows arm64 "" tailhome-windows-arm64.exe

chmod +x "${BUNDLE_DIR}/install.sh" "${BUNDLE_DIR}"/scripts/*.sh "${BUNDLE_DIR}"/dist/tailhome-*

archive_tmp="${WORK_DIR}/tailhome.tar.gz"
tar --sort=name --mtime='@0' --owner=0 --group=0 --numeric-owner -czf "${archive_tmp}" -C "${WORK_DIR}" tailhome
cp "${archive_tmp}" "${PUBLIC_DIR}/tailhome.tar.gz"
(
  cd "${PUBLIC_DIR}"
  sha256sum tailhome.tar.gz > tailhome.tar.gz.sha256
)
cp "${ROOT_DIR}/install.sh" "${PUBLIC_DIR}/install.sh"
cp "${ROOT_DIR}/install.ps1" "${PUBLIC_DIR}/install.ps1"

for asset in tailhome-windows-amd64.exe tailhome-windows-arm64.exe; do
  cp "${BUNDLE_DIR}/dist/${asset}" "${PUBLIC_DIR}/downloads/${asset}"
  (
    cd "${PUBLIC_DIR}/downloads"
    sha256sum "${asset}" > "${asset}.sha256"
  )
done

printf 'Installer assets written to %s\n' "${PUBLIC_DIR}"
du -h "${PUBLIC_DIR}/tailhome.tar.gz"
