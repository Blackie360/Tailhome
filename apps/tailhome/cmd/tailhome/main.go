package main

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

const version = "0.1.0"

type cli struct {
	stdout      io.Writer
	stderr      io.Writer
	tailhomeDir string
	useSudo     bool
}

func main() {
	c := newCLI(os.Stdout, os.Stderr)
	if err := c.run(os.Args[1:]); err != nil {
		fmt.Fprintf(c.stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func newCLI(stdout, stderr io.Writer) *cli {
	return &cli{
		stdout:      stdout,
		stderr:      stderr,
		tailhomeDir: envDefault("TAILHOME_DIR", "/opt/tailhome"),
		useSudo:     shouldUseSudo(),
	}
}

func envDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func (c *cli) run(args []string) error {
	cmd := ""
	if len(args) > 0 {
		cmd = args[0]
		args = args[1:]
	}

	switch cmd {
	case "", "-h", "--help", "help":
		c.usage()
	case "-v", "--version", "version":
		fmt.Fprintf(c.stdout, "TailHome %s\n", version)
	case "status", "ps":
		return c.compose("ps")
	case "urls":
		return c.urls()
	case "config":
		return c.config()
	case "env":
		return c.env()
	case "start":
		return c.compose(append([]string{"up", "-d"}, args...)...)
	case "stop":
		return c.compose(append([]string{"stop"}, args...)...)
	case "restart":
		return c.compose(append([]string{"restart"}, args...)...)
	case "update":
		if err := c.compose(append([]string{"pull"}, args...)...); err != nil {
			return err
		}
		return c.compose(append([]string{"up", "-d"}, args...)...)
	case "logs":
		return c.compose(append([]string{"logs", "-f"}, args...)...)
	case "backup":
		return c.backup(args)
	case "health", "doctor":
		return c.health()
	case "enable":
		return c.enable(args)
	default:
		c.usage()
		return fmt.Errorf("unknown command: %s", cmd)
	}

	return nil
}

func (c *cli) usage() {
	fmt.Fprintf(c.stdout, `TailHome %s

Usage:
  tailhome <command> [args]

Commands:
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
  tailhome backup [output-dir]
  tailhome health
  tailhome doctor
  tailhome enable subnet-router <cidr>
  tailhome enable exit-node
  tailhome version

Environment:
  TAILHOME_DIR=/opt/tailhome
  TAILHOME_USE_SUDO=0
`, version)
}

func (c *cli) requireStack() error {
	if stat, err := os.Stat(c.tailhomeDir); err != nil || !stat.IsDir() {
		return fmt.Errorf("TailHome directory not found: %s", c.tailhomeDir)
	}
	composeFile := filepath.Join(c.tailhomeDir, "docker-compose.yml")
	if stat, err := os.Stat(composeFile); err != nil || stat.IsDir() {
		return fmt.Errorf("compose file not found: %s", composeFile)
	}
	if _, err := exec.LookPath("docker"); err != nil {
		return errors.New("docker is required")
	}
	return nil
}

func (c *cli) compose(args ...string) error {
	if err := c.requireStack(); err != nil {
		return err
	}
	return c.runCommand(c.tailhomeDir, append([]string{"docker", "compose"}, args...)...)
}

func (c *cli) runCommand(dir string, args ...string) error {
	if len(args) == 0 {
		return errors.New("missing command")
	}
	if c.useSudo {
		args = append([]string{"sudo"}, args...)
	}

	command := exec.Command(args[0], args[1:]...)
	command.Dir = dir
	command.Stdout = c.stdout
	command.Stderr = c.stderr
	command.Stdin = os.Stdin
	return command.Run()
}

func (c *cli) envFile() string {
	return filepath.Join(c.tailhomeDir, ".env")
}

func (c *cli) loadEnv() (map[string]string, error) {
	values := map[string]string{}
	file, err := os.Open(c.envFile())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return values, nil
		}
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		values[strings.TrimSpace(key)] = strings.Trim(strings.TrimSpace(value), `"'`)
	}
	return values, scanner.Err()
}

func (c *cli) hostname() string {
	values, err := c.loadEnv()
	if err == nil && values["TAILHOME_HOSTNAME"] != "" {
		return values["TAILHOME_HOSTNAME"]
	}
	return "tailhome"
}

func (c *cli) tailscaleName() string {
	if _, err := exec.LookPath("tailscale"); err != nil {
		return ""
	}
	out, err := exec.Command("tailscale", "status", "--json").Output()
	if err != nil {
		return ""
	}
	text := string(out)
	marker := `"DNSName"`
	index := strings.Index(text, marker)
	if index == -1 {
		return ""
	}
	after := text[index+len(marker):]
	_, after, found := strings.Cut(after, ":")
	if !found {
		return ""
	}
	after = strings.TrimSpace(after)
	if !strings.HasPrefix(after, `"`) {
		return ""
	}
	after = strings.TrimPrefix(after, `"`)
	name, _, found := strings.Cut(after, `"`)
	if !found {
		return ""
	}
	return strings.TrimSuffix(name, ".")
}

func serviceURLs(host string) []string {
	return []string{
		fmt.Sprintf("  Homepage:    http://%s:3000", host),
		fmt.Sprintf("  Grafana:     http://%s:3001", host),
		fmt.Sprintf("  Prometheus:  http://%s:9090", host),
		fmt.Sprintf("  Portainer:   https://%s:9443", host),
		fmt.Sprintf("  Uptime Kuma: http://%s:3002", host),
		fmt.Sprintf("  Pi-hole:     http://%s:8080/admin", host),
		fmt.Sprintf("  Caddy:       http://%s:8088", host),
	}
}

func (c *cli) urls() error {
	fmt.Fprintln(c.stdout, "TailHome service URLs")
	fmt.Fprintln(c.stdout)
	fmt.Fprintln(c.stdout, "Local hostname:")
	for _, line := range serviceURLs(c.hostname()) {
		fmt.Fprintln(c.stdout, line)
	}

	if tsName := c.tailscaleName(); tsName != "" {
		fmt.Fprintln(c.stdout)
		fmt.Fprintln(c.stdout, "Tailscale DNS:")
		for _, line := range serviceURLs(tsName) {
			fmt.Fprintln(c.stdout, line)
		}
	}

	if _, err := os.Stat(c.envFile()); err == nil {
		fmt.Fprintf(c.stdout, "\nCredentials are stored in %s\n", c.envFile())
	}
	return nil
}

func (c *cli) config() error {
	values, err := c.loadEnv()
	if err != nil {
		return err
	}

	fmt.Fprintln(c.stdout, "TailHome configuration")
	fmt.Fprintln(c.stdout)
	fmt.Fprintf(c.stdout, "Install directory: %s\n", c.tailhomeDir)
	if _, err := os.Stat(c.envFile()); err == nil {
		fmt.Fprintf(c.stdout, "Environment file:  %s\n", c.envFile())
		fmt.Fprintf(c.stdout, "Hostname:          %s\n", values["TAILHOME_HOSTNAME"])
		fmt.Fprintf(c.stdout, "Timezone:          %s\n", values["TAILHOME_TIMEZONE"])
		fmt.Fprintf(c.stdout, "Grafana user:      %s\n", values["TAILHOME_GRAFANA_USER"])
	} else {
		fmt.Fprintln(c.stdout, "Environment file:  not found")
		fmt.Fprintf(c.stdout, "Hostname:          %s\n", c.hostname())
	}
	return nil
}

func (c *cli) env() error {
	values, err := c.loadEnv()
	if err != nil {
		return err
	}
	if len(values) == 0 {
		return fmt.Errorf("environment file not found: %s", c.envFile())
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	for _, key := range keys {
		value := values[key]
		if strings.Contains(key, "PASSWORD") || strings.Contains(key, "TOKEN") || strings.Contains(key, "SECRET") {
			value = "<hidden>"
		}
		fmt.Fprintf(c.stdout, "%s=%s\n", key, value)
	}
	return nil
}

func (c *cli) backup(args []string) error {
	if stat, err := os.Stat(c.tailhomeDir); err != nil || !stat.IsDir() {
		return fmt.Errorf("TailHome directory not found: %s", c.tailhomeDir)
	}

	outputDir := filepath.Join(envDefault("HOME", "."), "tailhome-backups")
	if len(args) > 0 && args[0] != "" {
		outputDir = args[0]
	}
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return err
	}

	archive := filepath.Join(outputDir, fmt.Sprintf("tailhome-%s.tar.gz", time.Now().Format("20060102-150405")))
	if err := c.runCommand("", "tar", "-C", c.tailhomeDir, "-czf", archive, "."); err != nil {
		return err
	}
	fmt.Fprintf(c.stdout, "Backup written to %s\n", archive)
	return nil
}

func (c *cli) health() error {
	script := filepath.Join(c.tailhomeDir, "scripts", "health-check.sh")
	if stat, err := os.Stat(script); err == nil && stat.Mode()&0111 != 0 {
		return c.runCommand("", script)
	}
	fmt.Fprintln(c.stderr, "warning: health-check.sh not found; showing compose status instead")
	return c.compose("ps")
}

func (c *cli) enable(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: tailhome enable subnet-router <cidr> | exit-node")
	}
	switch args[0] {
	case "subnet-router":
		if len(args) < 2 || args[1] == "" {
			return errors.New("usage: tailhome enable subnet-router <cidr>")
		}
		if err := c.runCommand("", "tailscale", "up", "--ssh", "--advertise-routes="+args[1]); err != nil {
			return err
		}
		fmt.Fprintln(c.stdout, "Approve the route in the Tailscale admin console if required.")
	case "exit-node":
		if err := c.runCommand("", "tailscale", "up", "--ssh", "--advertise-exit-node"); err != nil {
			return err
		}
		fmt.Fprintln(c.stdout, "Approve this device as an exit node in the Tailscale admin console if required.")
	default:
		return fmt.Errorf("unknown feature: %s", args[0])
	}
	return nil
}

func isExecutable(path string) bool {
	stat, err := os.Stat(path)
	return err == nil && stat.Mode().IsRegular() && stat.Mode()&0111 != 0
}

func sameFile(a, b string) bool {
	aInfo, aErr := os.Stat(a)
	bInfo, bErr := os.Stat(b)
	if aErr != nil || bErr != nil {
		return false
	}
	return os.SameFile(aInfo, bInfo)
}
