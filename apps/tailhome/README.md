# TailHome App

TailHome is a one-command private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins the machine to Tailscale, installs Docker, starts a useful Docker-based homelab stack, and installs the Go-based `tailhome` CLI.

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

Remote install from GitHub:

```bash
curl -fsSL https://tailhome.dev/install.sh | bash
```

If the web app is deployed at `tailhome.blackielabs.com`, use:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash
```

Or run the GitHub-hosted installer directly:

```bash
curl -fsSL https://raw.githubusercontent.com/Blackie360/Tailhome/main/install.sh | bash
```

Install only the CLI on Linux or macOS:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash -s -- --cli-only
```

Install the CLI on Windows PowerShell:

```powershell
iwr https://tailhome.blackielabs.com/install.ps1 -UseB | iex
```

Pin a versioned release:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | env TAILHOME_INSTALL_VERSION=v0.1.0 bash
```

The installer will:

1. Check the system.
2. Install Tailscale.
3. Run `tailscale up --ssh` and show the login prompt.
4. Install Docker.
5. Check required ports.
6. Create `/opt/tailhome`.
7. Download and install the matching Go CLI release binary as `tailhome`.
8. Start the Docker Compose stack.
9. Print service URLs.

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

Release binaries are built by GitHub Actions. Every push to `main`, including merged feature branches, updates the rolling `main-latest` prerelease. Pushing a `v*` tag creates a stable versioned release.

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
TAILHOME_BIN_DIR=/usr/local/bin
TAILHOME_CLI_BUILD_DIR=apps/tailhome/dist
TAILHOME_INSTALL_VERSION=main-latest
TAILHOME_CLI_URL=https://example.com/tailhome-linux-arm64
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
