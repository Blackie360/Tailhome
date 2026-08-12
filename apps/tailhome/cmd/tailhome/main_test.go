package main

import (
	"bytes"
	"os"
	"path/filepath"
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
		"http://test-tailhome:3000",
		"http://test-tailhome:3001",
		"http://test-tailhome:3002",
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
		"",
	}, "\n")
	if err := os.WriteFile(filepath.Join(dir, ".env"), []byte(content), 0600); err != nil {
		t.Fatal(err)
	}
}
