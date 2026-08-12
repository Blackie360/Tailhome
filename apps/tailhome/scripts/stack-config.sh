#!/usr/bin/env bash

# Generated consumer configuration shared by setup and feature enablement.

tailhome_profile_enabled() {
  local profile="$1"
  [[ ",${TAILHOME_PROFILES:-}," == *",${profile},"* ]]
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
		respond "TailHome is running. Open Homepage on port ${TAILHOME_HOMEPAGE_PORT} or run 'tailhome urls' for enabled services." 200
	}
}
CADDY

  ${SUDO:-} cp "${output}" "${TAILHOME_DIR}/configs/caddy/Caddyfile"
  rm -f -- "${output}"
}

tailhome_write_homepage_services() {
  local output
  output="$(mktemp)"

  cat > "${output}" <<YAML
- TailHome:
    - Caddy:
        href: http://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_CADDY_HTTP_PORT}
        description: TailHome gateway
        icon: caddy.png
        server: local
        container: tailhome-caddy
YAML

  if tailhome_profile_enabled monitoring || tailhome_profile_enabled uptime; then
    printf '\n- Observability:\n' >> "${output}"
    if tailhome_profile_enabled monitoring; then
      cat >> "${output}" <<YAML
    - Grafana:
        href: http://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_GRAFANA_PORT}
        description: Metrics dashboards
        icon: grafana.png
        server: local
        container: tailhome-grafana
    - Prometheus:
        href: http://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_PROMETHEUS_PORT}
        description: Metrics database
        icon: prometheus.png
        server: local
        container: tailhome-prometheus
YAML
    fi
    if tailhome_profile_enabled uptime; then
      cat >> "${output}" <<YAML
    - Uptime Kuma:
        href: http://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_UPTIME_PORT}
        description: Uptime monitoring
        icon: uptime-kuma.png
        server: local
        container: tailhome-uptime-kuma
YAML
    fi
  fi

  if tailhome_profile_enabled management; then
    cat >> "${output}" <<YAML

- Management:
    - Portainer:
        href: https://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_PORTAINER_PORT}
        description: Docker management
        icon: portainer.png
        server: local
        container: tailhome-portainer
YAML
  fi

  if tailhome_profile_enabled dns; then
    cat >> "${output}" <<YAML

- Network:
    - Pi-hole:
        href: http://{{HOMEPAGE_VAR_HOST}}:${TAILHOME_PIHOLE_WEB_PORT}/admin
        description: DNS filtering
        icon: pi-hole.png
        server: local
        container: tailhome-pihole
YAML
  fi

  ${SUDO:-} cp "${output}" "${TAILHOME_DIR}/configs/homepage/services.yaml"
  rm -f -- "${output}"
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
  tailhome_write_homepage_services
  tailhome_write_prometheus_config
}
