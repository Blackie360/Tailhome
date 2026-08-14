# TailHome App

TailHome is a one-command private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins the machine to Tailscale, installs Docker, starts a useful Docker-based homelab stack, and installs the Go-based `tailhome` CLI.

## Default Stack

- Tailscale
- Docker Engine
- Docker Compose
- Homepage
- Caddy
- Grafana
- Prometheus
- Node Exporter
- Uptime Kuma
- Portainer
- Pi-hole

TailHome installs the services it already ships by default. The onboarding flow still uses Compose profiles so you can deselect groups before install:

- `monitoring`: Grafana, Prometheus, and Node Exporter
- `uptime`: Uptime Kuma
- `management`: Portainer
- `dns`: Pi-hole

## Requirements

- Raspberry Pi OS, Debian, or Ubuntu
- `sudo`
- Internet access for package installation, Tailscale setup, Docker image pulls, release binary downloads, and optional remote install

The full Docker stack installer is Linux-only. macOS and Windows installers install the `tailhome` CLI only.

Go is not required on the target machine when a matching TailHome release binary is published. If the release binary is unavailable, the Linux stack installer falls back to a local Go build when Go is installed.

Docker and Tailscale can be installed by TailHome on Linux.

## Install From Checkout

From a cloned checkout:

```bash
./install.sh
```

Or run the app installer directly:

```bash
apps/tailhome/install.sh
```

The root `install.sh` is a wrapper for `apps/tailhome/install.sh`.

Safe installer path test without starting containers:

```bash
TAILHOME_USE_SUDO=0 TAILHOME_DIR=/tmp/tailhome-test TAILHOME_BIN_DIR=/tmp/tailhome-bin ./install.sh --skip-tailscale-install --skip-tailscale-login --skip-docker-install --no-start
```

Use `/tmp` only for no-start path tests. When starting containers, choose `/opt/tailhome`, a path under your home directory, or another path shared with Docker; Docker Desktop and rootless Docker setups may reject bind mounts from unshared locations.

Start the hosted interactive installer:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash
```

The installer opens an onboarding flow on the terminal even though the script is piped to Bash. It asks for a server name, Tailscale connection and routing choices, service profiles, exit-node mode, and whether to start the stack. The profile prompts default to yes, so accepting the defaults pulls the full current TailHome stack. It shows the complete plan before making changes.

Tailscale connection is best-effort during setup. TailHome installs and enables `tailscaled`, adds a systemd restart-policy drop-in, performs one bounded readiness cycle, and treats `NeedsLogin` as ready for `tailscale up --ssh`. Login output (including the AuthURL) streams to the terminal and is bounded by `TAILHOME_TAILSCALE_LOGIN_TIMEOUT` (default 180 seconds); a daemon or authentication failure never blocks Docker or the TailHome stack and is reported once in the final summary. Finish private access at any time with `tailhome connect`.

Before generating the stack, TailHome silently resolves every movable host port. Occupied preferences advance to the next available port, selected ports cannot collide with one another, and the result is persisted in `/opt/tailhome/.env`. Reruns preserve those saved ports. DNS remains fixed on TCP and UDP port 53; if a host-wide listener owns it, TailHome installs every other service and leaves DNS disabled until `tailhome enable dns` succeeds.

For unattended automation, use `--non-interactive` (or `-y`) and environment values:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | env TAILHOME_INTERACTIVE=0 TAILHOME_HOSTNAME=tailhome TAILHOME_PROFILES=monitoring,uptime bash
```

On a fresh unattended install, leave `TAILHOME_PROFILES` unset to enable every current optional group (`monitoring,uptime,management,dns`). Set it to a comma-separated subset for a slimmer install:

```bash
TAILHOME_PROFILES=monitoring ./install.sh
```

Set it explicitly empty for core-only Homepage and Caddy:

```bash
TAILHOME_PROFILES= ./install.sh
```

When reinstalling or rerunning setup, omitting `TAILHOME_PROFILES` preserves the existing `COMPOSE_PROFILES` value in `/opt/tailhome/.env`.

Install only the CLI on Linux or macOS:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash -s -- --cli-only
```

Install the CLI on Windows PowerShell:

```powershell
iwr https://tailhome.blackielabs.com/install.ps1 -UseB | iex
```

The installer will:

1. Collect and confirm the setup choices when a terminal is available.
2. Check the system.
3. Install Tailscale, configure its restart policy, and attempt `tailscale up --ssh` when selected. The AuthURL is shown on the terminal; login waits are timed out via `TAILHOME_TAILSCALE_LOGIN_TIMEOUT`. Any failure is deferred to the final summary and never stops the Docker stack installation.
4. Install Docker.
5. Resolve and persist available host ports without extra prompts.
6. Create `/opt/tailhome` and its generated service configuration.
7. Install the matching bundled Go CLI as `tailhome`.
8. Pull and start the enabled Docker Compose profiles. Core services must start; Pi-hole disables the `dns` profile if port 53 is unavailable, and Node Exporter is best-effort when a Docker setup rejects the host-root mount.
9. Run a health check and print URLs for enabled services.

## CLI Commands

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
tailhome connect
tailhome enable dns
tailhome enable subnet-router 192.168.1.0/24
tailhome enable exit-node
tailhome version
```

Command summary:

- `status` or `ps` shows the Docker Compose stack.
- `urls` prints local and Tailscale service URLs.
- `config` shows the active TailHome directory and non-secret config.
- `env` prints TailHome environment values with secrets hidden.
- `start`, `stop`, `restart`, `update`, and `logs` manage Compose services.
- `backup` writes a timestamped archive of the TailHome install directory.
- `health` or `doctor` checks core dependencies and stack health.
- `connect` restarts `tailscaled`, waits for its local API, and retries streamed `tailscale up --ssh` with `TAILHOME_TAILSCALE_LOGIN_TIMEOUT` per attempt.
- `enable dns` validates TCP and UDP port 53, regenerates Homepage/Caddy configuration, and starts Pi-hole.
- `enable subnet-router <cidr>` and `enable exit-node` update Tailscale routing.

## Build CLI

The `tailhome` CLI is written in Go.

```bash
cd apps/tailhome
scripts/build-cli.sh
```

The default build output is `apps/tailhome/dist/tailhome`. The installer downloads and installs a release binary automatically. If that download is unavailable, it builds the CLI locally when Go is available.

To choose another output path:

```bash
scripts/build-cli.sh /tmp/tailhome
```

Release binaries are built by GitHub Actions. The hosted installer also carries small, self-contained, checksummed bundles for each supported OS and architecture, so it downloads only the matching CLI and works without public access to the repository or GitHub release assets. Interrupted transfers resume automatically. Rebuild the bundles after CLI or installer changes:

```bash
pnpm installer:build
```

Expected asset names:

```text
tailhome-linux-amd64
tailhome-linux-arm64
tailhome-linux-armv7
tailhome-linux-armv6
tailhome-darwin-amd64
tailhome-darwin-arm64
tailhome-windows-amd64.exe
tailhome-windows-arm64.exe
```

## Validate Locally

```bash
apps/tailhome/scripts/validate.sh
```

Validation checks shell syntax and Docker Compose config. When Go is installed, it also runs `go test ./cmd/tailhome` and builds a test CLI binary.

## Service URLs

Default local URLs (the installer prints and persists adjusted ports when any default is occupied):

```text
Homepage:    http://tailhome:3000
Caddy:       http://tailhome:8088
Grafana:     http://tailhome:3001
Prometheus:  http://tailhome:9090
Portainer:   https://tailhome:9443
Uptime Kuma: http://tailhome:3002
Pi-hole:     http://tailhome:8080/admin
```

URLs and Caddy redirects follow enabled profiles. A core-only install prints only Homepage and Caddy. When the related profiles are enabled, Caddy provides simple redirects for `/grafana`, `/prometheus`, `/uptime`, `/pihole`, and `/portainer`. If Pi-hole cannot bind DNS on port 53, TailHome disables the `dns` profile and regenerates this view without Pi-hole.

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
TAILHOME_PROFILES=monitoring,uptime,management,dns
TAILHOME_GRAFANA_PASSWORD=change-me
TAILHOME_PIHOLE_PASSWORD=change-me
TAILHOME_HOMEPAGE_PORT=3000
TAILHOME_GRAFANA_PORT=3001
TAILHOME_UPTIME_PORT=3002
TAILHOME_CADDY_HTTP_PORT=8088
TAILHOME_CADDY_HTTPS_PORT=8443
TAILHOME_PROMETHEUS_PORT=9090
TAILHOME_NODE_EXPORTER_PORT=9100
TAILHOME_PORTAINER_PORT=9443
TAILHOME_PIHOLE_WEB_PORT=8080
TAILHOME_USE_SUDO=0
TAILHOME_BIN_DIR=/usr/local/bin
TAILHOME_CLI_BUILD_DIR=apps/tailhome/dist
TAILHOME_CLI_URL=https://example.com/tailhome-linux-arm64
TAILHOME_INSTALL_URL=https://example.com/tailhome-linux-amd64.tar.gz
TAILHOME_DOWNLOAD_ATTEMPTS=5
TAILHOME_DOWNLOAD_RETRY_DELAY=2
TAILHOME_INTERACTIVE=0
TAILHOME_ORIGIN=https://tailhome.blackielabs.com
```

Example:

```bash
TAILHOME_SUBNET_ROUTES=192.168.1.0/24 ./install.sh
```

## Security Notes

- TailHome exposes service ports on the host. Use Tailscale and firewall rules to restrict access.
- Pi-hole binds DNS on port 53 when the `dns` profile is enabled. Loopback-only systemd-resolved listeners (`127.0.0.53:53` / `127.0.0.54:53`) remain allowed. A host-wide TCP or UDP listener disables only `dns`; free port 53 and run `tailhome enable dns` to validate, regenerate configuration, and start Pi-hole.
- TailHome does not automatically update containers. Review release notes and run `tailhome update` when ready.
- Do not publish `/opt/tailhome/.env`; it contains generated passwords.

Pi-hole v6 uses `FTLCONF_webserver_api_password` for the web/API password. TailHome writes that through Docker Compose.

## Roadmap

- Additional profiles: `ai`, `dev`, `storage`
- Web setup dashboard
- Grafana dashboards
- Tailscale Serve integration
- Backup and restore workflow
- Uninstall command
