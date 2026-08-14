package main

import (
	"bytes"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestVersion(t *testing.T) {
	c := testCLI(t)

	if err := c.run([]string{"version"}); err != nil {
		t.Fatal(err)
	}

	if got := c.stdout.(*bytes.Buffer).String(); !strings.Contains(got, "TailHome 0.1.0") {
		t.Fatalf("expected version output, got %q", got)
	}
}

func TestURLsUseConfiguredHostname(t *testing.T) {
	c := testCLI(t)
	writeEnv(t, c.tailhomeDir)

	if err := c.run([]string{"urls"}); err != nil {
		t.Fatal(err)
	}

	got := c.stdout.(*bytes.Buffer).String()
	for _, want := range []string{
		"http://test-tailhome:3100",
		"http://test-tailhome:3101",
		"http://test-tailhome:3102",
		"http://test-tailhome:9180",
		"Credentials are stored in " + filepath.Join(c.tailhomeDir, ".env"),
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in output:\n%s", want, got)
		}
	}
	for _, unwanted := range []string{"Pi-hole", "Portainer"} {
		if strings.Contains(got, unwanted) {
			t.Fatalf("did not expect %q in output:\n%s", unwanted, got)
		}
	}
}

func TestConnectRetriesDaemonAndAuthenticatesNeedsLogin(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell fixture requires Unix")
	}
	c := testCLI(t)
	writeEnv(t, c.tailhomeDir)
	fakeBin := t.TempDir()
	stateFile := filepath.Join(fakeBin, "state")
	loginFile := filepath.Join(fakeBin, "login-state")
	logFile := filepath.Join(fakeBin, "calls")
	writeExecutable(t, filepath.Join(fakeBin, "systemctl"), "#!/usr/bin/env bash\nprintf 'systemctl %s\\n' \"$*\" >> '"+logFile+"'\nexit 0\n")
	writeExecutable(t, filepath.Join(fakeBin, "tailscale"), `#!/usr/bin/env bash
printf 'tailscale %s\n' "$*" >> '`+logFile+`'
count=0
[[ -f '`+stateFile+`' ]] && count="$(cat '`+stateFile+`')"
case "$*" in
  "status --json")
    count=$((count + 1))
    printf '%s\n' "$count" > '`+stateFile+`'
    if [[ "$count" -lt 3 ]]; then
      printf 'local API unavailable\n' >&2
      exit 1
    elif [[ "$count" -eq 3 ]]; then
      printf '{"BackendState":"NeedsLogin"}\n'
    else
      printf '{"BackendState":"Running"}\n'
    fi
    ;;
  "up --ssh --advertise-routes=192.168.1.0/24")
    login_count=0
    [[ -f '`+loginFile+`' ]] && login_count="$(cat '`+loginFile+`')"
    login_count=$((login_count + 1))
    printf '%s\n' "$login_count" > '`+loginFile+`'
    [[ "$login_count" -ge 3 ]]
    ;;
  *) exit 1 ;;
esac
`)
	t.Setenv("PATH", fakeBin+string(os.PathListSeparator)+os.Getenv("PATH"))
	t.Setenv("TAILHOME_TAILSCALE_READY_ATTEMPTS", "4")
	t.Setenv("TAILHOME_TAILSCALE_READY_DELAY", "0")
	t.Setenv("TAILHOME_TAILSCALE_LOGIN_ATTEMPTS", "3")
	t.Setenv("TAILHOME_TAILSCALE_LOGIN_DELAY", "0")
	t.Setenv("TAILHOME_TAILSCALE_LOGIN_TIMEOUT", "5")

	if err := c.run([]string{"connect"}); err != nil {
		t.Fatal(err)
	}
	got := c.stdout.(*bytes.Buffer).String()
	if !strings.Contains(got, "Complete Tailscale login in your browser") {
		t.Fatalf("expected login prompt, got %q", got)
	}
	if !strings.Contains(got, "Tailscale is connected") {
		t.Fatalf("expected connected output, got %q", got)
	}
	calls, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatal(err)
	}
	if count := strings.Count(string(calls), "systemctl start tailscaled"); count != 3 {
		t.Fatalf("expected 3 daemon start attempts, got %d:\n%s", count, calls)
	}
	if count := strings.Count(string(calls), "tailscale up --ssh"); count != 3 {
		t.Fatalf("expected 3 login attempts, got %d:\n%s", count, calls)
	}
}

func TestEnableDNSRunsInstalledRegenerator(t *testing.T) {
	c := testCLI(t)
	script := filepath.Join(c.tailhomeDir, "scripts", "enable-dns.sh")
	writeExecutable(t, script, "#!/usr/bin/env bash\nprintf 'dns regenerated and started\\n'\n")

	if err := c.run([]string{"enable", "dns"}); err != nil {
		t.Fatal(err)
	}
	if got := c.stdout.(*bytes.Buffer).String(); !strings.Contains(got, "dns regenerated and started") {
		t.Fatalf("unexpected output %q", got)
	}
}

func TestURLsDefaultToCoreServices(t *testing.T) {
	c := testCLI(t)
	content := "TAILHOME_HOSTNAME=test-tailhome\nCOMPOSE_PROFILES=\n"
	if err := os.WriteFile(filepath.Join(c.tailhomeDir, ".env"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	if err := c.run([]string{"urls"}); err != nil {
		t.Fatal(err)
	}

	got := c.stdout.(*bytes.Buffer).String()
	for _, want := range []string{"Homepage", "Caddy"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in output:\n%s", want, got)
		}
	}
	for _, unwanted := range []string{"Grafana", "Prometheus", "Uptime Kuma", "Portainer", "Pi-hole"} {
		if strings.Contains(got, unwanted) {
			t.Fatalf("did not expect %q in output:\n%s", unwanted, got)
		}
	}
}

func TestStatusUsesResolvedPorts(t *testing.T) {
	c := testCLI(t)
	writeEnv(t, c.tailhomeDir)
	if err := os.WriteFile(filepath.Join(c.tailhomeDir, "docker-compose.yml"), []byte("services: {}\n"), 0600); err != nil {
		t.Fatal(err)
	}
	fakeBin := t.TempDir()
	writeExecutable(t, filepath.Join(fakeBin, "docker"), "#!/usr/bin/env bash\n[[ \"$*\" == \"compose ps\" ]]\n")
	t.Setenv("PATH", fakeBin+string(os.PathListSeparator)+os.Getenv("PATH"))

	if err := c.run([]string{"status"}); err != nil {
		t.Fatal(err)
	}
	got := c.stdout.(*bytes.Buffer).String()
	for _, want := range []string{"http://test-tailhome:3100", "http://test-tailhome:3101", "http://test-tailhome:9180"} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in status output:\n%s", want, got)
		}
	}
}

func TestEnvMasksSecrets(t *testing.T) {
	c := testCLI(t)
	writeEnv(t, c.tailhomeDir)

	if err := c.run([]string{"env"}); err != nil {
		t.Fatal(err)
	}

	got := c.stdout.(*bytes.Buffer).String()
	for _, want := range []string{
		"TAILHOME_GRAFANA_PASSWORD=<hidden>",
		"TAILHOME_PIHOLE_PASSWORD=<hidden>",
		"TAILHOME_HOSTNAME=test-tailhome",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in output:\n%s", want, got)
		}
	}
	if strings.Contains(got, "secret-") {
		t.Fatalf("secret value leaked in output:\n%s", got)
	}
}

func TestUninstallRequiresYes(t *testing.T) {
	c := testCLI(t)
	err := c.run([]string{"uninstall"})
	if err == nil {
		t.Fatal("expected error without --yes")
	}
	if !strings.Contains(err.Error(), "--yes") {
		t.Fatalf("expected --yes reminder, got %v", err)
	}
}

func TestUninstallRemovesStackBinaryAndDropIn(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell fixture requires Unix")
	}
	c := testCLI(t)
	writeEnv(t, c.tailhomeDir)
	if err := os.WriteFile(filepath.Join(c.tailhomeDir, "docker-compose.yml"), []byte("services: {}\n"), 0600); err != nil {
		t.Fatal(err)
	}

	binDir := t.TempDir()
	cliPath := filepath.Join(binDir, "tailhome")
	writeExecutable(t, cliPath, "#!/usr/bin/env bash\nexit 0\n")
	t.Setenv("TAILHOME_BIN_DIR", binDir)

	systemdRoot := t.TempDir()
	dropInDir := filepath.Join(systemdRoot, "tailscaled.service.d")
	dropInFile := filepath.Join(dropInDir, "override.conf")
	if err := os.MkdirAll(dropInDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(dropInFile, []byte("[Service]\nRestart=always\n"), 0644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TAILHOME_SYSTEMD_DIR", systemdRoot)

	fakeBin := t.TempDir()
	logFile := filepath.Join(fakeBin, "calls")
	writeExecutable(t, filepath.Join(fakeBin, "docker"), "#!/usr/bin/env bash\nprintf 'docker %s\\n' \"$*\" >> '"+logFile+"'\n[[ \"$*\" == \"compose down --volumes --remove-orphans\" ]]\n")
	writeExecutable(t, filepath.Join(fakeBin, "systemctl"), "#!/usr/bin/env bash\nprintf 'systemctl %s\\n' \"$*\" >> '"+logFile+"'\nexit 0\n")
	t.Setenv("PATH", fakeBin+string(os.PathListSeparator)+os.Getenv("PATH"))

	if err := c.run([]string{"uninstall", "--yes"}); err != nil {
		t.Fatal(err)
	}

	got := c.stdout.(*bytes.Buffer).String()
	for _, want := range []string{
		"Stopped and removed TailHome containers and volumes.",
		"Removed TailHome Tailscale systemd drop-in.",
		"Removed " + c.tailhomeDir,
		"Removed " + cliPath,
		"TailHome uninstall complete.",
		"Docker and Tailscale were left installed.",
	} {
		if !strings.Contains(got, want) {
			t.Fatalf("expected %q in output:\n%s", want, got)
		}
	}

	if _, err := os.Stat(c.tailhomeDir); !os.IsNotExist(err) {
		t.Fatalf("expected install dir removed, stat err=%v", err)
	}
	if _, err := os.Stat(cliPath); !os.IsNotExist(err) {
		t.Fatalf("expected CLI binary removed, stat err=%v", err)
	}
	if _, err := os.Stat(dropInFile); !os.IsNotExist(err) {
		t.Fatalf("expected drop-in removed, stat err=%v", err)
	}

	calls, err := os.ReadFile(logFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(calls), "docker compose down --volumes --remove-orphans") {
		t.Fatalf("expected compose down, got:\n%s", calls)
	}
	if !strings.Contains(string(calls), "systemctl daemon-reload") {
		t.Fatalf("expected daemon-reload, got:\n%s", calls)
	}
}

func TestUninstallIsIdempotentWhenAlreadyGone(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell fixture requires Unix")
	}
	c := testCLI(t)
	binDir := t.TempDir()
	t.Setenv("TAILHOME_BIN_DIR", binDir)
	t.Setenv("TAILHOME_SYSTEMD_DIR", t.TempDir())
	missingDir := filepath.Join(t.TempDir(), "missing-tailhome")
	c.tailhomeDir = missingDir

	if err := c.run([]string{"uninstall", "-y"}); err != nil {
		t.Fatal(err)
	}
	got := c.stdout.(*bytes.Buffer).String()
	if !strings.Contains(got, "No compose stack found") {
		t.Fatalf("expected skip compose message, got %q", got)
	}
	if !strings.Contains(got, "TailHome uninstall complete.") {
		t.Fatalf("expected completion, got %q", got)
	}
}

func testCLI(t *testing.T) *cli {
	t.Helper()
	t.Setenv("TAILHOME_USE_SUDO", "0")
	t.Setenv("TAILHOME_DIR", t.TempDir())

	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	return newCLI(stdout, stderr)
}

func writeEnv(t *testing.T, dir string) {
	t.Helper()
	content := strings.Join([]string{
		"TAILHOME_HOSTNAME=test-tailhome",
		"TAILHOME_TIMEZONE=UTC",
		"COMPOSE_PROFILES=monitoring,uptime",
		"TAILHOME_GRAFANA_USER=admin",
		"TAILHOME_GRAFANA_PASSWORD=secret-grafana",
		"TAILHOME_PIHOLE_PASSWORD=secret-pihole",
		"TAILHOME_HOMEPAGE_PORT=3100",
		"TAILHOME_GRAFANA_PORT=3101",
		"TAILHOME_UPTIME_PORT=3102",
		"TAILHOME_CADDY_HTTP_PORT=8188",
		"TAILHOME_PROMETHEUS_PORT=9180",
		"TAILHOME_NODE_EXPORTER_PORT=9200",
		"TAILHOME_PORTAINER_PORT=9543",
		"TAILHOME_PIHOLE_WEB_PORT=8180",
		"TAILHOME_SUBNET_ROUTES=192.168.1.0/24",
		"",
	}, "\n")
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}

func writeExecutable(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0755); err != nil {
		t.Fatal(err)
	}
}
