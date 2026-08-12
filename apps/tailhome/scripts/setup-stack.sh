#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TAILHOME_VERSION="0.1.0"
TAILHOME_DIR="${TAILHOME_DIR:-/opt/tailhome}"
TAILHOME_HOSTNAME="${TAILHOME_HOSTNAME:-tailhome}"
TAILHOME_BIN_DIR="${TAILHOME_BIN_DIR:-/usr/local/bin}"
TAILHOME_CLI_BUILD_DIR="${TAILHOME_CLI_BUILD_DIR:-${PROJECT_DIR}/dist}"
if [[ -v TAILHOME_PROFILES ]]; then
  TAILHOME_PROFILES_PRESET=1
else
  TAILHOME_PROFILES_PRESET=0
  TAILHOME_PROFILES=""
fi

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

existing_profiles() {
  local env_file="${TAILHOME_DIR}/.env"

  [[ -f "${env_file}" ]] || return 0
  ${SUDO} awk -F= '$1 == "COMPOSE_PROFILES" { print substr($0, index($0, "=") + 1); exit }' "${env_file}" 2>/dev/null || true
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 24 | tr -d '\n'
  else
    date +%s%N | sha256sum | awk '{print $1}'
  fi
}

download() {
  url="$1"
  output="$2"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "${url}" -o "${output}"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "${output}" "${url}"
  else
    return 1
  fi
}

detect_cli_arch() {
  case "$(uname -m)" in
    x86_64|amd64) printf 'amd64' ;;
    arm64|aarch64) printf 'arm64' ;;
    armv7l) printf 'armv7' ;;
    armv6l) printf 'armv6' ;;
    *) return 1 ;;
  esac
}

profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES}," == *",${profile},"* ]]
}

write_caddyfile() {
  local output
  output="$(mktemp)"

  cat > "${output}" <<'CADDY'
:80 {
CADDY

  if profile_enabled monitoring; then
    cat >> "${output}" <<'CADDY'
	handle /grafana* {
		redir http://{host}:3001
	}

	handle /prometheus* {
		redir http://{host}:9090
	}

CADDY
  fi

  if profile_enabled uptime; then
    cat >> "${output}" <<'CADDY'
	handle /uptime* {
		redir http://{host}:3002
	}

CADDY
  fi

  if profile_enabled dns; then
    cat >> "${output}" <<'CADDY'
	handle /pihole* {
		redir http://{host}:8080/admin
	}

CADDY
  fi

  if profile_enabled management; then
    cat >> "${output}" <<'CADDY'
	handle /portainer* {
		redir https://{host}:9443
	}

CADDY
  fi

  cat >> "${output}" <<'CADDY'
	handle {
		respond "TailHome is running. Open Homepage on port 3000 or run 'tailhome urls' for enabled services." 200
	}
}
CADDY

  ${SUDO} cp "${output}" "${TAILHOME_DIR}/configs/caddy/Caddyfile"
  rm -f -- "${output}"
}

write_homepage_services() {
  local output
  output="$(mktemp)"

  cat > "${output}" <<'YAML'
- TailHome:
    - Caddy:
        href: http://{{HOMEPAGE_VAR_HOST}}:8088
        description: TailHome gateway
        icon: caddy.png
        server: local
        container: tailhome-caddy
YAML

  if profile_enabled monitoring || profile_enabled uptime; then
    printf '\n- Observability:\n' >> "${output}"
    if profile_enabled monitoring; then
      cat >> "${output}" <<'YAML'
    - Grafana:
        href: http://{{HOMEPAGE_VAR_HOST}}:3001
        description: Metrics dashboards
        icon: grafana.png
        server: local
        container: tailhome-grafana
    - Prometheus:
        href: http://{{HOMEPAGE_VAR_HOST}}:9090
        description: Metrics database
        icon: prometheus.png
        server: local
        container: tailhome-prometheus
YAML
    fi
    if profile_enabled uptime; then
      cat >> "${output}" <<'YAML'
    - Uptime Kuma:
        href: http://{{HOMEPAGE_VAR_HOST}}:3002
        description: Uptime monitoring
        icon: uptime-kuma.png
        server: local
        container: tailhome-uptime-kuma
YAML
    fi
  fi

  if profile_enabled management; then
    cat >> "${output}" <<'YAML'

- Management:
    - Portainer:
        href: https://{{HOMEPAGE_VAR_HOST}}:9443
        description: Docker management
        icon: portainer.png
        server: local
        container: tailhome-portainer
YAML
  fi

  if profile_enabled dns; then
    cat >> "${output}" <<'YAML'

- Network:
    - Pi-hole:
        href: http://{{HOMEPAGE_VAR_HOST}}:8080/admin
        description: DNS filtering
        icon: pi-hole.png
        server: local
        container: tailhome-pihole
YAML
  fi

  ${SUDO} cp "${output}" "${TAILHOME_DIR}/configs/homepage/services.yaml"
  rm -f -- "${output}"
}

download_cli() {
  output="$1"
  arch="$(detect_cli_arch)" || return 1
  version="${TAILHOME_INSTALL_VERSION:-main-latest}"
  repo="${TAILHOME_INSTALL_REPO:-Blackie360/Tailhome}"
  url="${TAILHOME_CLI_URL:-https://github.com/${repo}/releases/download/${version}/tailhome-linux-${arch}}"

  printf 'Downloading TailHome CLI from %s\n' "${url}"
  mkdir -p "$(dirname "${output}")"
  download "${url}" "${output}" || return 1
  chmod +x "${output}"
}

if [[ "${TAILHOME_PROFILES_PRESET}" -eq 0 ]]; then
  TAILHOME_PROFILES="$(existing_profiles)"
fi

${SUDO} mkdir -p "${TAILHOME_DIR}"
${SUDO} cp -R "${PROJECT_DIR}/configs" "${TAILHOME_DIR}/"
${SUDO} cp -R "${PROJECT_DIR}/scripts" "${TAILHOME_DIR}/"
${SUDO} cp "${PROJECT_DIR}/docker-compose.yml" "${TAILHOME_DIR}/docker-compose.yml"
${SUDO} chmod +x "${TAILHOME_DIR}"/scripts/*.sh
write_caddyfile
write_homepage_services

if [[ ! -f "${TAILHOME_DIR}/.env" ]]; then
  grafana_password="${TAILHOME_GRAFANA_PASSWORD:-$(random_password)}"
  pihole_password="${TAILHOME_PIHOLE_PASSWORD:-$(random_password)}"
  timezone="${TAILHOME_TIMEZONE:-$(cat /etc/timezone 2>/dev/null || printf 'UTC')}"

  ${SUDO} tee "${TAILHOME_DIR}/.env" >/dev/null <<ENV
TAILHOME_HOSTNAME=${TAILHOME_HOSTNAME}
TAILHOME_TIMEZONE=${timezone}
COMPOSE_PROFILES=${TAILHOME_PROFILES}
TAILHOME_GRAFANA_USER=admin
TAILHOME_GRAFANA_PASSWORD=${grafana_password}
TAILHOME_PIHOLE_PASSWORD=${pihole_password}
ENV
elif ${SUDO} grep -q '^COMPOSE_PROFILES=' "${TAILHOME_DIR}/.env"; then
  ${SUDO} sed -i "s/^COMPOSE_PROFILES=.*/COMPOSE_PROFILES=${TAILHOME_PROFILES}/" "${TAILHOME_DIR}/.env"
else
  printf 'COMPOSE_PROFILES=%s\n' "${TAILHOME_PROFILES}" | ${SUDO} tee -a "${TAILHOME_DIR}/.env" >/dev/null
fi

cli_source="${TAILHOME_CLI_BUILD_DIR}/tailhome"
if [[ ! -x "${cli_source}" ]]; then
  bundled_cli="${PROJECT_DIR}/dist/tailhome-linux-$(detect_cli_arch)"
  if [[ -x "${bundled_cli}" ]]; then
    mkdir -p "$(dirname "${cli_source}")"
    cp "${bundled_cli}" "${cli_source}"
    chmod +x "${cli_source}"
    printf 'Using the bundled TailHome CLI for %s.\n' "$(uname -m)"
  elif ! download_cli "${cli_source}"; then
    if command -v go >/dev/null 2>&1; then
      printf 'Falling back to local Go build for TailHome CLI.\n'
      "${PROJECT_DIR}/scripts/build-cli.sh" "${cli_source}"
    else
      printf 'error: could not download TailHome CLI and Go is not installed for local build.\n' >&2
      printf 'Set TAILHOME_CLI_URL to a prebuilt binary or publish the %s release assets.\n' "${TAILHOME_INSTALL_VERSION:-main-latest}" >&2
      exit 1
    fi
  fi
fi

${SUDO} mkdir -p "${TAILHOME_BIN_DIR}"
${SUDO} cp "${cli_source}" "${TAILHOME_BIN_DIR}/tailhome"
${SUDO} chmod +x "${TAILHOME_BIN_DIR}/tailhome"

cd "${TAILHOME_DIR}"
if [[ "${TAILHOME_NO_START:-0}" == "1" ]]; then
  docker compose config >/dev/null
  printf 'TailHome stack rendered successfully. Skipping container start.\n'
else
  ${SUDO} docker compose pull --policy missing
  ${SUDO} docker compose up -d
fi

printf 'TailHome stack created at %s.\n' "${TAILHOME_DIR}"
