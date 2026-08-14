package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
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
	case "status":
		return c.status()
	case "ps":
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
	case "connect":
		return c.connect()
	case "uninstall":
		return c.uninstall(args)
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
  tailhome connect
  tailhome enable dns
  tailhome enable subnet-router <cidr>
  tailhome enable exit-node
  tailhome uninstall --yes
  tailhome version

Environment:
  TAILHOME_DIR=/opt/tailhome
  TAILHOME_BIN_DIR=/usr/local/bin
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
	return c.runCommandWithTimeout(dir, 0, args...)
}

func (c *cli) runCommandWithTimeout(dir string, timeout time.Duration, args ...string) error {
	if len(args) == 0 {
		return errors.New("missing command")
	}
	if c.useSudo {
		args = append([]string{"sudo"}, args...)
	}

	ctx := context.Background()
	var cancel context.CancelFunc
	if timeout > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), timeout)
		defer cancel()
	}

	command := exec.CommandContext(ctx, args[0], args[1:]...)
	command.Dir = dir
	command.Stdout = c.stdout
	command.Stderr = c.stderr
	command.Stdin = os.Stdin
	err := command.Run()
	if timeout > 0 && errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return fmt.Errorf("timed out after %s", timeout)
	}
	return err
}

func (c *cli) commandOutput(dir string, args ...string) ([]byte, error) {
	if len(args) == 0 {
		return nil, errors.New("missing command")
	}
	if c.useSudo {
		args = append([]string{"sudo"}, args...)
	}
	command := exec.Command(args[0], args[1:]...)
	command.Dir = dir
	return command.CombinedOutput()
}

func (c *cli) envFile() string {
	return filepath.Join(c.tailhomeDir, ".env")
}

func (c *cli) loadEnv() (map[string]string, error) {
	values := map[string]string{}
	content, err := c.readFile(c.envFile())
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return values, nil
		}
		return nil, err
	}

	scanner := bufio.NewScanner(strings.NewReader(string(content)))
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

func (c *cli) readFile(path string) ([]byte, error) {
	content, err := os.ReadFile(path)
	if err == nil {
		return content, nil
	}
	if errors.Is(err, os.ErrNotExist) || !c.useSudo || !isPermissionError(err) {
		return nil, err
	}
	output, sudoErr := c.commandOutput("", "cat", path)
	if sudoErr != nil {
		if len(output) > 0 {
			return nil, fmt.Errorf("%w: %s", err, firstDiagnostic(output))
		}
		return nil, err
	}
	return output, nil
}

func isPermissionError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, os.ErrPermission) {
		return true
	}
	var pathErr *os.PathError
	if errors.As(err, &pathErr) {
		return errors.Is(pathErr.Err, os.ErrPermission) || strings.Contains(strings.ToLower(pathErr.Err.Error()), "permission denied")
	}
	return strings.Contains(strings.ToLower(err.Error()), "permission denied")
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

func enabledProfiles(values map[string]string) map[string]bool {
	profiles := map[string]bool{}
	for _, profile := range strings.Split(values["COMPOSE_PROFILES"], ",") {
		profile = strings.TrimSpace(profile)
		if profile != "" {
			profiles[profile] = true
		}
	}
	return profiles
}

func configuredPort(values map[string]string, name, fallback string) string {
	if value := values[name]; value != "" {
		return value
	}
	return fallback
}

func serviceURLs(host string, profiles map[string]bool, values map[string]string) []string {
	urls := []string{
		fmt.Sprintf("  Homepage:    http://%s:%s", host, configuredPort(values, "TAILHOME_HOMEPAGE_PORT", "3000")),
		fmt.Sprintf("  Caddy:       http://%s:%s", host, configuredPort(values, "TAILHOME_CADDY_HTTP_PORT", "8088")),
	}
	if profiles["monitoring"] {
		urls = append(urls,
			fmt.Sprintf("  Grafana:     http://%s:%s", host, configuredPort(values, "TAILHOME_GRAFANA_PORT", "3001")),
			fmt.Sprintf("  Prometheus:  http://%s:%s", host, configuredPort(values, "TAILHOME_PROMETHEUS_PORT", "9090")),
		)
	}
	if profiles["uptime"] {
		urls = append(urls,
			fmt.Sprintf("  Uptime Kuma: http://%s:%s", host, configuredPort(values, "TAILHOME_UPTIME_PORT", "3002")),
		)
	}
	if profiles["management"] {
		urls = append(urls,
			fmt.Sprintf("  Portainer:   https://%s:%s", host, configuredPort(values, "TAILHOME_PORTAINER_PORT", "9443")),
		)
	}
	if profiles["dns"] {
		urls = append(urls,
			fmt.Sprintf("  Pi-hole:     http://%s:%s/admin", host, configuredPort(values, "TAILHOME_PIHOLE_WEB_PORT", "8080")),
		)
	}
	return urls
}

func (c *cli) urls() error {
	values, err := c.loadEnv()
	if err != nil {
		return err
	}
	profiles := enabledProfiles(values)

	fmt.Fprintln(c.stdout, "TailHome service URLs")
	fmt.Fprintln(c.stdout)
	fmt.Fprintln(c.stdout, "Local hostname:")
	for _, line := range serviceURLs(c.hostname(), profiles, values) {
		fmt.Fprintln(c.stdout, line)
	}

	if tsName := c.tailscaleName(); tsName != "" {
		fmt.Fprintln(c.stdout)
		fmt.Fprintln(c.stdout, "Tailscale DNS:")
		for _, line := range serviceURLs(tsName, profiles, values) {
			fmt.Fprintln(c.stdout, line)
		}
	}

	if _, err := os.Stat(c.envFile()); err == nil {
		fmt.Fprintf(c.stdout, "\nCredentials are stored in %s\n", c.envFile())
	}
	return nil
}

func (c *cli) status() error {
	values, err := c.loadEnv()
	if err != nil {
		return err
	}
	fmt.Fprintln(c.stdout, "TailHome status")
	for _, line := range serviceURLs(c.hostname(), enabledProfiles(values), values) {
		fmt.Fprintln(c.stdout, line)
	}
	fmt.Fprintln(c.stdout)
	return c.compose("ps")
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
		fmt.Fprintf(c.stdout, "Service profiles:  %s\n", envDefaultFromMap(values, "COMPOSE_PROFILES", "core only"))
		if enabledProfiles(values)["monitoring"] {
			fmt.Fprintf(c.stdout, "Grafana user:      %s\n", values["TAILHOME_GRAFANA_USER"])
		}
	} else {
		fmt.Fprintln(c.stdout, "Environment file:  not found")
		fmt.Fprintf(c.stdout, "Hostname:          %s\n", c.hostname())
	}
	return nil
}

func envDefaultFromMap(values map[string]string, name, fallback string) string {
	if value := values[name]; value != "" {
		return value
	}
	return fallback
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

type tailscaleStatus struct {
	BackendState string `json:"BackendState"`
}

func parseTailscaleState(output []byte) string {
	var status tailscaleStatus
	if json.Unmarshal(output, &status) != nil {
		return ""
	}
	return status.BackendState
}

func positiveEnvInt(name string, fallback int) int {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value < 1 {
		return fallback
	}
	return value
}

func envDurationSeconds(name string, fallback int) time.Duration {
	value, err := strconv.Atoi(os.Getenv(name))
	if err != nil || value < 0 {
		value = fallback
	}
	return time.Duration(value) * time.Second
}

func firstDiagnostic(output []byte) string {
	line := strings.TrimSpace(strings.SplitN(string(output), "\n", 2)[0])
	if len(line) > 240 {
		line = line[:240]
	}
	return line
}

func (c *cli) connect() error {
	if _, err := exec.LookPath("tailscale"); err != nil {
		return errors.New("tailscale is not installed")
	}

	values, err := c.loadEnv()
	if err != nil {
		return err
	}

	readyAttempts := positiveEnvInt("TAILHOME_TAILSCALE_READY_ATTEMPTS", 12)
	readyDelay := envDurationSeconds("TAILHOME_TAILSCALE_READY_DELAY", 5)
	state := ""
	lastDiagnostic := "tailscaled local API is unavailable"
	_, systemctlErr := exec.LookPath("systemctl")
	hasSystemctl := systemctlErr == nil
	for attempt := 1; attempt <= readyAttempts; attempt++ {
		if hasSystemctl {
			if output, err := c.commandOutput("", "systemctl", "start", "tailscaled"); err != nil && len(output) > 0 {
				lastDiagnostic = firstDiagnostic(output)
			}
		}
		output, err := c.commandOutput("", "tailscale", "status", "--json")
		state = parseTailscaleState(output)
		if state == "Running" {
			if err := c.applyTailscaleHostname(values["TAILHOME_HOSTNAME"]); err != nil {
				fmt.Fprintf(c.stderr, "warning: could not set Tailscale hostname: %v\n", err)
			}
			fmt.Fprintln(c.stdout, "Tailscale is connected.")
			return nil
		}
		if state == "NeedsLogin" {
			break
		}
		if err != nil && len(output) > 0 {
			lastDiagnostic = firstDiagnostic(output)
		} else if state != "" {
			lastDiagnostic = "tailscaled backend state: " + state
		}
		if attempt < readyAttempts {
			time.Sleep(readyDelay)
		}
	}
	if state != "NeedsLogin" {
		return fmt.Errorf("Tailscale connection is still pending: %s", lastDiagnostic)
	}

	upArgs := []string{"tailscale", "up", "--ssh"}
	upArgs = appendTailscaleHostname(upArgs, values["TAILHOME_HOSTNAME"])
	if values["TAILHOME_ENABLE_EXIT_NODE"] == "1" {
		upArgs = append(upArgs, "--advertise-exit-node")
	}
	if routes := values["TAILHOME_SUBNET_ROUTES"]; routes != "" {
		upArgs = append(upArgs, "--advertise-routes="+routes)
	}

	loginAttempts := positiveEnvInt("TAILHOME_TAILSCALE_LOGIN_ATTEMPTS", 3)
	loginDelay := envDurationSeconds("TAILHOME_TAILSCALE_LOGIN_DELAY", 5)
	loginTimeout := envDurationSeconds("TAILHOME_TAILSCALE_LOGIN_TIMEOUT", 180)
	fmt.Fprintf(c.stdout, "Complete Tailscale login in your browser when prompted. Waiting up to %s per attempt.\n", loginTimeout)
	for attempt := 1; attempt <= loginAttempts; attempt++ {
		upErr := c.runCommandWithTimeout("", loginTimeout, upArgs...)
		if upErr == nil {
			statusOutput, _ := c.commandOutput("", "tailscale", "status", "--json")
			if parseTailscaleState(statusOutput) == "Running" {
				fmt.Fprintln(c.stdout, "Tailscale is connected.")
				return nil
			}
			lastDiagnostic = "authentication has not completed"
		} else {
			lastDiagnostic = upErr.Error()
		}
		if attempt < loginAttempts {
			time.Sleep(loginDelay)
		}
	}
	return fmt.Errorf("Tailscale connection is still pending: %s", lastDiagnostic)
}

func appendTailscaleHostname(args []string, hostname string) []string {
	hostname = strings.TrimSpace(hostname)
	if hostname == "" {
		return args
	}
	return append(args, "--hostname="+hostname)
}

func (c *cli) applyTailscaleHostname(hostname string) error {
	hostname = strings.TrimSpace(hostname)
	if hostname == "" {
		return nil
	}
	if err := c.runCommand("", "tailscale", "set", "--hostname="+hostname); err != nil {
		return err
	}
	fmt.Fprintf(c.stdout, "Tailscale hostname set to %s.\n", hostname)
	return nil
}

func (c *cli) enable(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: tailhome enable dns | subnet-router <cidr> | exit-node")
	}
	switch args[0] {
	case "dns":
		script := filepath.Join(c.tailhomeDir, "scripts", "enable-dns.sh")
		if !isExecutable(script) {
			return fmt.Errorf("DNS enablement script not found: %s", script)
		}
		return c.runCommand("", script)
	case "subnet-router":
		if len(args) < 2 || args[1] == "" {
			return errors.New("usage: tailhome enable subnet-router <cidr>")
		}
		upArgs := appendTailscaleHostname([]string{"tailscale", "up", "--ssh"}, c.hostname())
		upArgs = append(upArgs, "--advertise-routes="+args[1])
		if err := c.runCommand("", upArgs...); err != nil {
			return err
		}
		fmt.Fprintln(c.stdout, "Approve the route in the Tailscale admin console if required.")
	case "exit-node":
		upArgs := appendTailscaleHostname([]string{"tailscale", "up", "--ssh"}, c.hostname())
		upArgs = append(upArgs, "--advertise-exit-node")
		if err := c.runCommand("", upArgs...); err != nil {
			return err
		}
		fmt.Fprintln(c.stdout, "Approve this device as an exit node in the Tailscale admin console if required.")
	default:
		return fmt.Errorf("unknown feature: %s", args[0])
	}
	return nil
}

func (c *cli) uninstall(args []string) error {
	confirmed := false
	for _, arg := range args {
		switch arg {
		case "--yes", "-y":
			confirmed = true
		case "-h", "--help":
			fmt.Fprintln(c.stdout, "Usage: tailhome uninstall --yes")
			return nil
		default:
			return fmt.Errorf("unknown flag: %s\nusage: tailhome uninstall --yes", arg)
		}
	}
	if !confirmed {
		return errors.New("refusing to uninstall without --yes; re-run: tailhome uninstall --yes")
	}

	composeFile := filepath.Join(c.tailhomeDir, "docker-compose.yml")
	if _, err := os.Stat(composeFile); err == nil {
		if _, err := exec.LookPath("docker"); err == nil {
			if err := c.runCommand(c.tailhomeDir, "docker", "compose", "down", "--volumes", "--remove-orphans"); err != nil {
				fmt.Fprintf(c.stderr, "warning: docker compose down failed: %v\n", err)
			} else {
				fmt.Fprintln(c.stdout, "Stopped and removed TailHome containers and volumes.")
			}
		} else {
			fmt.Fprintln(c.stdout, "Docker not found; skipping compose teardown.")
		}
	} else {
		fmt.Fprintln(c.stdout, "No compose stack found; skipping container teardown.")
	}

	if err := c.removeTailscaleDropIn(); err != nil {
		fmt.Fprintf(c.stderr, "warning: could not remove Tailscale drop-in: %v\n", err)
	}

	if _, err := os.Stat(c.tailhomeDir); err == nil {
		if err := c.removePath(c.tailhomeDir); err != nil {
			return fmt.Errorf("failed to remove %s: %w", c.tailhomeDir, err)
		}
		fmt.Fprintf(c.stdout, "Removed %s\n", c.tailhomeDir)
	} else {
		fmt.Fprintf(c.stdout, "Install directory already absent: %s\n", c.tailhomeDir)
	}

	binPath := c.cliBinaryPath()
	if _, err := os.Stat(binPath); err == nil {
		if err := c.removePath(binPath); err != nil {
			return fmt.Errorf("failed to remove %s: %w", binPath, err)
		}
		fmt.Fprintf(c.stdout, "Removed %s\n", binPath)
	} else {
		fmt.Fprintf(c.stdout, "CLI binary already absent: %s\n", binPath)
	}

	fmt.Fprintln(c.stdout, "TailHome uninstall complete.")
	fmt.Fprintln(c.stdout, "Docker and Tailscale were left installed.")
	fmt.Fprintln(c.stdout, "Optional: run `tailscale logout` or remove those packages yourself if you no longer need them.")
	return nil
}

func (c *cli) cliBinaryPath() string {
	name := "tailhome"
	if runtime.GOOS == "windows" {
		name = "tailhome.exe"
	}
	return filepath.Join(envDefault("TAILHOME_BIN_DIR", "/usr/local/bin"), name)
}

func (c *cli) removePath(path string) error {
	return c.runCommand("", "rm", "-rf", path)
}

func (c *cli) removeTailscaleDropIn() error {
	systemdRoot := envDefault("TAILHOME_SYSTEMD_DIR", "/etc/systemd/system")
	dropInDir := filepath.Join(systemdRoot, "tailscaled.service.d")
	dropInFile := filepath.Join(dropInDir, "override.conf")
	if _, err := os.Stat(dropInFile); err != nil {
		if os.IsNotExist(err) {
			fmt.Fprintln(c.stdout, "No TailHome Tailscale systemd drop-in found.")
			return nil
		}
		return err
	}
	if err := c.removePath(dropInFile); err != nil {
		return err
	}
	_ = c.runCommand("", "rmdir", dropInDir)
	if _, err := exec.LookPath("systemctl"); err == nil {
		_ = c.runCommand("", "systemctl", "daemon-reload")
	}
	fmt.Fprintln(c.stdout, "Removed TailHome Tailscale systemd drop-in.")
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
