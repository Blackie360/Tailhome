# TailHome

TailHome is a private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins a machine to Tailscale, installs Docker, starts Homepage, Caddy, monitoring, uptime, management, and DNS services by default, and installs a Go-based `tailhome` CLI for day-to-day administration. The Compose profile system remains available when you want a slimmer install.

This repository is a monorepo. The TailHome app lives in `apps/tailhome`, leaving room for future related apps, packages, and tooling.

## Repository Layout

```text
.
|-- apps/
|   `-- tailhome/
|       |-- cmd/tailhome/       # Go CLI source
|       |-- configs/            # Service configuration
|       |-- scripts/            # Installer and validation scripts
|       |-- docker-compose.yml  # Default homelab stack
|       `-- install.sh          # App installer
|   `-- web/                    # Next.js app for tailhome.blackielabs.com
`-- install.sh                  # Root wrapper for apps/tailhome/install.sh
```

## Quick Start

From a cloned checkout:

```bash
./install.sh
```

Or start the hosted interactive installer:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | bash
```

The onboarding asks for the server name, Tailscale connection and routing choices, service profiles, and whether to start the services. The current TailHome stack defaults to yes for monitoring, uptime, management, and DNS, so accepting the prompts installs the full set TailHome ships today. It then shows a summary before making changes. The installer checks the system, installs Tailscale and Docker when needed, creates `/opt/tailhome`, installs the bundled Go CLI, starts the enabled Docker Compose services, and prints their URLs. Interrupted downloads resume automatically instead of restarting from zero.

For automation, skip prompts and supply configuration through environment values:

```bash
curl -fsSL https://tailhome.blackielabs.com/install.sh | env TAILHOME_INTERACTIVE=0 TAILHOME_HOSTNAME=tailhome TAILHOME_PROFILES=monitoring,uptime bash
```

When `TAILHOME_PROFILES` is unset on a fresh install, TailHome enables `monitoring,uptime,management,dns`. Set `TAILHOME_PROFILES=monitoring` for just that group plus core, or set `TAILHOME_PROFILES=` for a core-only install with Homepage and Caddy. On reinstall, leaving `TAILHOME_PROFILES` unset preserves the existing profile selection.

## Go CLI

Build the CLI directly:

```bash
cd apps/tailhome
scripts/build-cli.sh
```

Run common commands after installation:

```bash
tailhome status
tailhome urls
tailhome config
tailhome logs
tailhome backup
tailhome update
tailhome version
```

## Validate

```bash
apps/tailhome/scripts/validate.sh
```

When Go is installed, validation also runs the Go CLI tests and builds a test binary. Without Go, validation still checks shell scripts and Docker Compose config.

## Web App

The website for `tailhome.blackielabs.com` lives in `apps/web`.
Its `/install.sh`, `/install.ps1`, small checksummed platform bundles, and Windows binaries are static assets. Each machine downloads only its matching CLI, and the public installer has no runtime dependency on access to the private GitHub repository. Rebuild those assets after installer or CLI changes:

```bash
pnpm install
pnpm installer:build
pnpm web:build
```

## More Detail

See `apps/tailhome/README.md` for full installation options, environment variables, service URLs, security notes, and roadmap.
