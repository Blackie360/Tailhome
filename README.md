# TailHome

TailHome is a private homelab installer for Raspberry Pi OS, Debian, and Ubuntu. It joins a machine to Tailscale, installs Docker, starts a useful service stack, and installs a Go-based `tailhome` CLI for day-to-day administration.

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
`-- install.sh                  # Root wrapper for apps/tailhome/install.sh
```

## Quick Start

From a cloned checkout:

```bash
./install.sh
```

The installer checks the system, installs Tailscale and Docker when needed, builds the Go CLI, creates `/opt/tailhome`, starts the Docker Compose stack, and prints service URLs.

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

## More Detail

See `apps/tailhome/README.md` for full installation options, environment variables, service URLs, security notes, and roadmap.
