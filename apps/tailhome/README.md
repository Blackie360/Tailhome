# TailHome

TailHome is a one-command private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins the machine to Tailscale and starts a useful Docker-based homelab stack.

## Default Stack

- Tailscale
- Docker Engine
- Docker Compose
- Grafana
- Prometheus
- Node Exporter
- Uptime Kuma
- Portainer
- Homepage
- Caddy
- Pi-hole
- Watchtower

## Install

From a cloned checkout:

```bash
./install.sh
```

Or run the app installer directly:

```bash
apps/tailhome/install.sh
```

Safe installer path test without starting containers:

```bash
TAILHOME_USE_SUDO=0 TAILHOME_DIR=/tmp/tailhome-test TAILHOME_BIN_DIR=/tmp/tailhome-bin ./install.sh --skip-tailscale-install --skip-tailscale-login --skip-docker-install --no-start
```

Remote install, once you publish the repo:

```bash
curl -fsSL https://tailhome.dev/install.sh | bash
```

The installer will:

1. Check the system.
2. Install Tailscale.
3. Run `tailscale up --ssh` and show the login prompt.
4. Install Docker.
5. Check required ports.
6. Create `/opt/tailhome`.
7. Start the Docker Compose stack.
8. Print service URLs.

## Useful Commands

```bash
tailhome status
tailhome ps
tailhome urls
tailhome config
tailhome env
tailhome start [service...]
tailhome stop [service...]
tailhome restart [service...]
tailhome update [service...]
tailhome logs [service]
tailhome backup
tailhome health
tailhome doctor
tailhome enable subnet-router 192.168.1.0/24
tailhome enable exit-node
tailhome version
```

## Build CLI

The `tailhome` CLI is written in Go.

```bash
cd apps/tailhome
scripts/build-cli.sh
```

The default build output is `apps/tailhome/dist/tailhome`. The installer builds and installs this CLI automatically when Go is available.

## Validate Locally

```bash
apps/tailhome/scripts/validate.sh
```

## Service URLs

Default local URLs:

```text
Homepage:    http://tailhome:3000
Grafana:     http://tailhome:3001
Prometheus:  http://tailhome:9090
Portainer:   https://tailhome:9443
Uptime Kuma: http://tailhome:3002
Pi-hole:     http://tailhome:8080/admin
Caddy:       http://tailhome:8088
```

Caddy provides simple redirects at `/grafana`, `/prometheus`, `/uptime`, `/pihole`, and `/portainer`.

Generated passwords are stored in:

```text
/opt/tailhome/.env
```

## Environment Options

```bash
TAILHOME_DIR=/opt/tailhome
TAILHOME_HOSTNAME=tailhome
TAILHOME_ENABLE_EXIT_NODE=1
TAILHOME_SUBNET_ROUTES=192.168.1.0/24
TAILHOME_GRAFANA_PASSWORD=change-me
TAILHOME_PIHOLE_PASSWORD=change-me
TAILHOME_SKIP_PORT_CHECK=1
TAILHOME_USE_SUDO=0
```

Example:

```bash
TAILHOME_SUBNET_ROUTES=192.168.1.0/24 ./install.sh
```

## Security Notes

- TailHome exposes service ports on the host. Use Tailscale and firewall rules to restrict access.
- Pi-hole binds DNS on port 53. Stop other DNS services if port 53 is already used.
- Watchtower updates containers automatically every day at 04:00. Remove it if you prefer manual updates.
- Do not publish `/opt/tailhome/.env`; it contains generated passwords.

Pi-hole v6 uses `FTLCONF_webserver_api_password` for the web/API password. TailHome writes that through Docker Compose.

## Roadmap

- Install profiles: `minimal`, `monitoring`, `dns`, `full`, `ai`, `dev`, `storage`
- Web setup dashboard
- Grafana dashboards
- Tailscale Serve integration
- Backup and restore workflow
- Uninstall command
