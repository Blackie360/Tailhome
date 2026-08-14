#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "${APP_DIR}/../.." && pwd)"
SRC="${ROOT_DIR}/apps/dashboard/dist"
DEST="${APP_DIR}/internal/dashboard/web/static"

mkdir -p "${DEST}"
if [[ -f "${SRC}/index.html" ]]; then
  find "${DEST}" -mindepth 1 -delete
  cp -R "${SRC}/." "${DEST}/"
  printf 'Synced dashboard UI from %s\n' "${SRC}"
else
  if [[ ! -f "${DEST}/index.html" ]]; then
    cat > "${DEST}/index.html" <<'HTML'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TailHome</title>
  </head>
  <body>
    <p>TailHome dashboard UI is not built. Run <code>pnpm --filter @tailhome/dashboard build</code>.</p>
  </body>
</html>
HTML
  fi
  printf 'Dashboard UI dist not found; using placeholder at %s\n' "${DEST}"
fi
