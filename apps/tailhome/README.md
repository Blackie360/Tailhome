# TailHome App

TailHome is a one-command private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins the machine to Tailscale, installs Docker, starts a useful Docker-based homelab stack, and installs the Go-based `tailhome` CLI.

## Lightweight Default Stack

- Tailscale
- Docker Engine
- Docker Compose
- Homepage
- Caddy

The onboarding flow keeps the first download small and asks before enabling optional profiles:

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

Start the hosted interactive installer:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash
```

The installer opens an onboarding flow on the terminal even though the script is piped to Bash. It asks for a server name, Tailscale connection and routing choices, optional service profiles, exit-node mode, and whether to start the stack. Optional services default to no, so the first install only pulls Homepage and Caddy. It shows the complete plan before making changes.

For unattended automation, use `--non-interactive` (or `-y`) and environment values:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | env TAILHOME_INTERACTIVE=0 TAILHOME_HOSTNAME=tailhome TAILHOME_PROFILES=monitoring,uptime bash
```

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
3. Install Tailscale and run `tailscale up --ssh` when selected.
4. Install Docker.
5. Check ports required by the selected profiles.
6. Create `/opt/tailhome`.
7. Install the matching bundled Go CLI as `tailhome`.
8. Pull and start only the selected Docker Compose profiles.
9. Run a health check and print URLs only for enabled services.

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

Core local URLs:

```text
Homepage:    http://tailhome:3000
Caddy:       http://tailhome:8088
```

Optional URLs appear only when their profiles are enabled:

```text
Grafana:     http://tailhome:3001
Prometheus:  http://tailhome:9090
Portainer:   https://tailhome:9443
Uptime Kuma: http://tailhome:3002
Pi-hole:     http://tailhome:8080/admin
```

Caddy provides simple redirects only for enabled optional services: `/grafana`, `/prometheus`, `/uptime`, `/pihole`, and `/portainer`.

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
TAILHOME_SKIP_PORT_CHECK=1
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
- Pi-hole is optional and binds DNS on port 53 only when the `dns` profile is selected.
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
