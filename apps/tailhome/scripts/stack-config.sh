#!/usr/bin/env bash

# Generated consumer configuration shared by setup and feature enablement.

tailhome_profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES:-}," == *",${profile},"* ]]
}

tailhome_json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

tailhome_write_caddyfile() {
  local output
  output="$(mktemp)"

  cat > "${output}" <<CADDY
:80 {
CADDY

  if tailhome_profile_enabled monitoring; then
    cat >> "${output}" <<CADDY
	handle /grafana* {
		redir http://{host}:${TAILHOME_GRAFANA_PORT}
	}

	handle /prometheus* {
		redir http://{host}:${TAILHOME_PROMETHEUS_PORT}
	}

CADDY
  fi
  if tailhome_profile_enabled uptime; then
    cat >> "${output}" <<CADDY
	handle /uptime* {
		redir http://{host}:${TAILHOME_UPTIME_PORT}
	}

CADDY
  fi
  if tailhome_profile_enabled dns; then
    cat >> "${output}" <<CADDY
	handle /pihole* {
		redir http://{host}:${TAILHOME_PIHOLE_WEB_PORT}/admin
	}

CADDY
  fi
  if tailhome_profile_enabled management; then
    cat >> "${output}" <<CADDY
	handle /portainer* {
		redir https://{host}:${TAILHOME_PORTAINER_PORT}
	}

CADDY
  fi

  cat >> "${output}" <<CADDY
	handle {
		respond "TailHome is running. Open the dashboard on port ${TAILHOME_HOMEPAGE_PORT} or run 'tailhome urls' for enabled services." 200
	}
}
CADDY

  ${SUDO:-} cp "${output}" "${TAILHOME_DIR}/configs/caddy/Caddyfile"
  rm -f -- "${output}"
}

tailhome_service_json() {
  local name="$1"
  local href="$2"
  local description="$3"
  local icon="$4"
  local container="$5"
  printf '{"name":"%s","href":"%s","description":"%s","icon":"%s","container":"%s"}' \
    "$(tailhome_json_escape "${name}")" \
    "$(tailhome_json_escape "${href}")" \
    "$(tailhome_json_escape "${description}")" \
    "$(tailhome_json_escape "${icon}")" \
    "$(tailhome_json_escape "${container}")"
}

tailhome_write_dashboard_services() {
  local host="${TAILHOME_HOSTNAME:-tailhome}"
  local groups=""
  local observability=""
  local output

  groups="$(printf '{"name":"TailHome","services":[%s]}' \
    "$(tailhome_service_json Caddy "http://${host}:${TAILHOME_CADDY_HTTP_PORT}" "TailHome gateway" caddy tailhome-caddy)")"

  if tailhome_profile_enabled monitoring; then
    observability="$(tailhome_service_json Grafana "http://${host}:${TAILHOME_GRAFANA_PORT}" "Metrics dashboards" grafana tailhome-grafana)"
    observability="${observability},$(tailhome_service_json Prometheus "http://${host}:${TAILHOME_PROMETHEUS_PORT}" "Metrics database" prometheus tailhome-prometheus)"
  fi
  if tailhome_profile_enabled uptime; then
    observability="${observability:+${observability},}$(tailhome_service_json "Uptime Kuma" "http://${host}:${TAILHOME_UPTIME_PORT}" "Uptime monitoring" uptime-kuma tailhome-uptime-kuma)"
  fi
  if [[ -n "${observability}" ]]; then
    groups="${groups},$(printf '{"name":"Observability","services":[%s]}' "${observability}")"
  fi

  if tailhome_profile_enabled management; then
    groups="${groups},$(printf '{"name":"Management","services":[%s]}' \
      "$(tailhome_service_json Portainer "https://${host}:${TAILHOME_PORTAINER_PORT}" "Docker management" portainer tailhome-portainer)")"
  fi

  if tailhome_profile_enabled dns; then
    groups="${groups},$(printf '{"name":"Network","services":[%s]}' \
      "$(tailhome_service_json Pi-hole "http://${host}:${TAILHOME_PIHOLE_WEB_PORT}/admin" "DNS filtering" pi-hole tailhome-pihole)")"
  fi

  output="$(mktemp)"
  printf '{"groups":[%s]}\n' "${groups}" > "${output}"
  ${SUDO:-} mkdir -p "${TAILHOME_DIR}/configs/dashboard"
  ${SUDO:-} cp "${output}" "${TAILHOME_DIR}/configs/dashboard/services.json"
  rm -f -- "${output}"

  if ! ${SUDO:-} test -f "${TAILHOME_DIR}/configs/dashboard/bookmarks.json"; then
    printf '{"groups":[]}\n' | ${SUDO:-} tee "${TAILHOME_DIR}/configs/dashboard/bookmarks.json" >/dev/null
  fi
}

tailhome_write_prometheus_config() {
  local output
  output="$(mktemp)"
  cat > "${output}" <<YAML
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets:
          - localhost:9090

  - job_name: node-exporter
    static_configs:
      - targets:
          - host.docker.internal:${TAILHOME_NODE_EXPORTER_PORT}

  - job_name: grafana
    metrics_path: /metrics
    static_configs:
      - targets:
          - grafana:3000
YAML
  ${SUDO:-} cp "${output}" "${TAILHOME_DIR}/configs/prometheus/prometheus.yml"
  rm -f -- "${output}"
}

tailhome_write_consumer_configs() {
  tailhome_write_caddyfile
  tailhome_write_dashboard_services
  tailhome_write_prometheus_config
}
