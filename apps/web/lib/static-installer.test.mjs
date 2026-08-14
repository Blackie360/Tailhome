import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const { default: nextConfig } = await import("../next.config.mjs");
const platformAssets = [
  "tailhome-linux-amd64",
  "tailhome-linux-arm64",
  "tailhome-linux-armv7",
  "tailhome-linux-armv6",
  "tailhome-darwin-amd64",
  "tailhome-darwin-arm64",
  "tailhome-windows-amd64.exe",
  "tailhome-windows-arm64.exe"
];

test("the website serves the current root shell installer", async () => {
  const [rootInstaller, staticInstaller] = await Promise.all([
    readFile(new URL("../../../install.sh", import.meta.url), "utf8"),
    readFile(new URL("../public/install.sh", import.meta.url), "utf8")
  ]);

  assert.equal(staticInstaller, rootInstaller);
});

test("the readable installer page uses the hosted shell installer source", async () => {
  const [sourceReader, page] = await Promise.all([
    readFile(new URL("./installer-source.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/install/page.tsx", import.meta.url), "utf8")
  ]);

  assert.match(sourceReader, /public", "install\.sh"/);
  assert.match(page, /readInstallerSource/);
  assert.match(page, /href="\/install\.sh"/);
});

test("the marketing installer source link opens the readable page", async () => {
  const commandBuilder = await readFile(new URL("../components/command-builder.tsx", import.meta.url), "utf8");

  assert.match(commandBuilder, /href="\/install"/);
  assert.doesNotMatch(commandBuilder, /href="\/install\.sh"/);
});

test("the shell installer is readable inline in browsers", async () => {
  const headers = await nextConfig.headers();
  const installerRoute = headers.find((route) => route.source === "/install.sh");

  assert.ok(installerRoute, "missing /install.sh header route");
  assert.deepEqual(installerRoute.headers, [
    {
      key: "Content-Type",
      value: "text/plain; charset=utf-8"
    },
    {
      key: "Content-Disposition",
      value: "inline"
    }
  ]);
});

test("the website serves the current PowerShell installer", async () => {
  const [rootInstaller, staticInstaller] = await Promise.all([
    readFile(new URL("../../../install.ps1", import.meta.url), "utf8"),
    readFile(new URL("../public/install.ps1", import.meta.url), "utf8")
  ]);

  assert.equal(staticInstaller, rootInstaller);
  assert.doesNotMatch(staticInstaller, /github\.com/);
});

test("each hosted platform bundle contains exactly its matching CLI and a valid checksum", async () => {
  const appInstaller = await readFile(new URL("../../tailhome/install.sh", import.meta.url), "utf8");

  await Promise.all(platformAssets.map(async (asset) => {
    const archive = new URL(`../public/downloads/${asset}.tar.gz`, import.meta.url);
    const [{ stdout: listing }, { stdout: bundledInstaller }, archiveContents, checksum] = await Promise.all([
      execFileAsync("tar", ["-tzf", archive.pathname]),
      execFileAsync("tar", ["-xOzf", archive.pathname, "tailhome/install.sh"]),
      readFile(archive),
      readFile(new URL(`../public/downloads/${asset}.tar.gz.sha256`, import.meta.url), "utf8")
    ]);
    const entries = new Set(listing.trim().split("\n"));
    const binaries = [...entries].filter((entry) => entry.startsWith("tailhome/dist/") && entry !== "tailhome/dist/");

    assert.ok(entries.has("tailhome/install.sh"), `missing installer in ${asset} bundle`);
    assert.ok(entries.has("tailhome/docker-compose.yml"), `missing compose file in ${asset} bundle`);
    assert.ok(entries.has("tailhome/scripts/setup-stack.sh"), `missing setup script in ${asset} bundle`);
    assert.deepEqual(binaries, [`tailhome/dist/${asset}`]);
    assert.equal(bundledInstaller, appInstaller, `stale installer in ${asset} bundle`);

    const expected = checksum.trim().split(/\s+/)[0];
    const actual = createHash("sha256").update(archiveContents).digest("hex");
    assert.equal(actual, expected, `checksum mismatch for ${asset} bundle`);
  }));
});

test("the installer is safe to stream into bash", async () => {
  const installer = await readFile(new URL("../../../install.sh", import.meta.url), "utf8");
  assert.match(installer, /SCRIPT_SOURCE="\$\{BASH_SOURCE\[0\]-\}"/);
  assert.doesNotMatch(installer, /archive\/\$\{REF\}\.tar\.gz/);
  assert.match(installer, /downloads\/\$\{asset\}\.tar\.gz/);
  assert.match(installer, /--continue-at/);
});

test("the shell installer keeps CLI-only mode available outside the web UI", async () => {
  const installer = await readFile(new URL("../../../install.sh", import.meta.url), "utf8");
  assert.match(installer, /--cli-only\)/);
  assert.match(installer, /INSTALL_MODE="cli-only"/);
});

test("Tailscale install configures restart policy without a readiness cycle", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-tailscaled-ready-test-"));
  const fakeBin = join(tempDir, "fake-bin");
  const stateFile = join(tempDir, "tailscale-status-count");
  const systemctlLog = join(tempDir, "systemctl.log");
  const systemdRoot = join(tempDir, "systemd");
  const installer = fileURLToPath(new URL("../../tailhome/scripts/install-tailscale.sh", import.meta.url));

  await mkdir(fakeBin, { recursive: true });
  await Promise.all([
    writeFile(join(fakeBin, "systemctl"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${systemctlLog}"
exit 0
`),
    writeFile(join(fakeBin, "tailscale"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${stateFile}"
exit 1
`)
  ]);
  await Promise.all([
    chmod(join(fakeBin, "systemctl"), 0o755),
    chmod(join(fakeBin, "tailscale"), 0o755)
  ]);

  try {
    await execFileAsync("bash", [installer], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_SYSTEMD_DIR: systemdRoot,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    await assert.rejects(readFile(stateFile, "utf8"), { code: "ENOENT" });
    const systemctlCalls = await readFile(systemctlLog, "utf8");
    assert.match(systemctlCalls, /daemon-reload/);
    assert.match(systemctlCalls, /enable --now tailscaled/);
    assert.equal(await readFile(join(systemdRoot, "tailscaled.service.d", "override.conf"), "utf8"), `[Unit]
StartLimitIntervalSec=0

[Service]
Restart=always
RestartSec=5s
`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Tailscale login failure is deferred to one final pending summary", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-tailscale-login-test-"));
  const fakeBin = join(tempDir, "fake-bin");
  const cliBuildDir = join(tempDir, "cli-build");
  const installDir = join(tempDir, "stack");
  const binDir = join(tempDir, "bin");
  const tailscaleLog = join(tempDir, "tailscale.log");
  const installer = fileURLToPath(new URL("../../tailhome/install.sh", import.meta.url));

  await Promise.all([
    mkdir(fakeBin, { recursive: true }),
    mkdir(cliBuildDir, { recursive: true })
  ]);
  await Promise.all([
    writeFile(join(fakeBin, "docker"), "#!/usr/bin/env bash\n[[ \"$*\" == \"compose config\" ]]\n"),
    writeFile(join(fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(fakeBin, "tailscale"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${tailscaleLog}"
case "$*" in
  "status --json")
    printf '{"BackendState":"NeedsLogin"}\\n'
    exit 0
    ;;
  up*)
    printf 'failed to connect to local tailscaled; 503 Service Unavailable: no backend\\n' >&2
    exit 1
    ;;
  *)
    exit 1
    ;;
esac
`),
    writeFile(join(cliBuildDir, "tailhome"), "#!/usr/bin/env bash\nprintf 'fake TailHome CLI\\n'\n")
  ]);
  await Promise.all([
    chmod(join(fakeBin, "docker"), 0o755),
    chmod(join(fakeBin, "tailscale"), 0o755),
    chmod(join(fakeBin, "ss"), 0o755),
    chmod(join(cliBuildDir, "tailhome"), 0o755)
  ]);

  try {
    const { stdout, stderr } = await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: binDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: installDir,
        TAILHOME_SUBNET_ROUTES: "192.168.1.0/24",
        TAILHOME_TAILSCALE_LOGIN_TIMEOUT: "5",
        TAILHOME_TAILSCALE_READY_ATTEMPTS: "1",
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    const output = `${stdout}\n${stderr}`;
    const tailscaleCalls = await readFile(tailscaleLog, "utf8");

    assert.match(output, /TailHome is ready/);
    assert.match(output, /Complete Tailscale login in your browser/);
    assert.match(output, /Tailscale\s+connection pending/);
    assert.match(output, /tailhome connect/);
    assert.doesNotMatch(output, /warning:.*Tailscale/i);
    assert.match(tailscaleCalls, /up --ssh --advertise-routes=192\.168\.1\.0\/24/);
    assert.equal(tailscaleCalls.match(/^status --json$/gm)?.length, 1);
    assert.equal(tailscaleCalls.match(/^up /gm)?.length, 1);
    assert.match(await readFile(join(installDir, ".env"), "utf8"), /^COMPOSE_PROFILES=monitoring,uptime,management,dns$/m);
    assert.match(await readFile(join(installDir, ".tailscale-diagnostic"), "utf8"), /tailscale up failed \(exit 1\)/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("Tailscale AuthURL streams and login timeout does not hang install", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-tailscale-timeout-test-"));
  const fakeBin = join(tempDir, "fake-bin");
  const cliBuildDir = join(tempDir, "cli-build");
  const installDir = join(tempDir, "stack");
  const binDir = join(tempDir, "bin");
  const tailscaleLog = join(tempDir, "tailscale.log");
  const installer = fileURLToPath(new URL("../../tailhome/install.sh", import.meta.url));

  await Promise.all([
    mkdir(fakeBin, { recursive: true }),
    mkdir(cliBuildDir, { recursive: true })
  ]);
  await Promise.all([
    writeFile(join(fakeBin, "docker"), "#!/usr/bin/env bash\n[[ \"$*\" == \"compose config\" ]]\n"),
    writeFile(join(fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(fakeBin, "tailscale"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${tailscaleLog}"
case "$*" in
  "status --json")
    printf '{"BackendState":"NeedsLogin"}\\n'
    exit 0
    ;;
  up*)
    printf 'To authenticate, visit:\\n\\n\\thttps://login.tailscale.com/a/testauth\\n\\n'
    sleep 30
    exit 0
    ;;
  *)
    exit 1
    ;;
esac
`),
    writeFile(join(cliBuildDir, "tailhome"), "#!/usr/bin/env bash\nprintf 'fake TailHome CLI\\n'\n")
  ]);
  await Promise.all([
    chmod(join(fakeBin, "docker"), 0o755),
    chmod(join(fakeBin, "tailscale"), 0o755),
    chmod(join(fakeBin, "ss"), 0o755),
    chmod(join(cliBuildDir, "tailhome"), 0o755)
  ]);

  try {
    const started = Date.now();
    const { stdout, stderr } = await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: binDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: installDir,
        TAILHOME_TAILSCALE_LOGIN_TIMEOUT: "2",
        TAILHOME_TAILSCALE_READY_ATTEMPTS: "1",
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    const elapsedMs = Date.now() - started;
    const output = `${stdout}\n${stderr}`;

    assert.ok(elapsedMs < 15_000, `install hung for ${elapsedMs}ms`);
    assert.match(output, /https:\/\/login\.tailscale\.com\/a\/testauth/);
    assert.match(output, /TailHome is ready/);
    assert.match(output, /Tailscale\s+connection pending/);
    assert.match(await readFile(join(installDir, ".tailscale-diagnostic"), "utf8"), /timed out after 2s/);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("explicit --no-start stays authoritative during interactive onboarding", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-no-start-test-"));
  const fakeBin = join(tempDir, "fake-bin");
  const cliBuildDir = join(tempDir, "cli-build");
  const installDir = join(tempDir, "stack");
  const binDir = join(tempDir, "bin");
  const installer = fileURLToPath(new URL("../../tailhome/install.sh", import.meta.url));

  await Promise.all([
    mkdir(fakeBin, { recursive: true }),
    mkdir(cliBuildDir, { recursive: true })
  ]);
  await Promise.all([
    writeFile(join(fakeBin, "docker"), "#!/usr/bin/env bash\n[[ \"$*\" == \"compose config\" ]]\n"),
    writeFile(join(fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(cliBuildDir, "tailhome"), "#!/usr/bin/env bash\nprintf 'fake TailHome CLI\\n'\n")
  ]);
  await Promise.all([
    chmod(join(fakeBin, "docker"), 0o755),
    chmod(join(fakeBin, "ss"), 0o755),
    chmod(join(cliBuildDir, "tailhome"), 0o755)
  ]);

  try {
    const { stdout, stderr } = await execFileAsync("bash", [
      "-c",
      `printf 'tailhome-test\\nn\\nn\\nn\\nn\\ny\\n' | script -qec "bash '${installer}' --skip-tailscale-install --skip-tailscale-login --skip-docker-install --no-start" /dev/null`
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: binDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: installDir,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    const output = `${stdout}\n${stderr}`;

    assert.doesNotMatch(output, /Start the TailHome services after setup/);
    assert.match(output, /Start services\s+no/);
    assert.doesNotMatch(output, /\[busy\]/);
    assert.match(output, /TailHome is ready/);

    const [envFile, homepageServices, caddyFile] = await Promise.all([
      readFile(join(installDir, ".env"), "utf8"),
      readFile(join(installDir, "configs", "homepage", "services.yaml"), "utf8"),
      readFile(join(installDir, "configs", "caddy", "Caddyfile"), "utf8")
    ]);
    assert.match(envFile, /^COMPOSE_PROFILES=$/m);
    assert.match(homepageServices, /Caddy/);
    assert.doesNotMatch(homepageServices, /Grafana|Prometheus|Uptime Kuma|Portainer|Pi-hole/);
    assert.doesNotMatch(caddyFile, /\/grafana|\/prometheus|\/uptime|\/portainer|\/pihole/);

    const defaultInstallDir = join(tempDir, "default-stack");
    const defaultBinDir = join(tempDir, "default-bin");
    await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-tailscale-login",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: defaultBinDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: defaultInstallDir,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });

    const [defaultEnv, defaultServices, defaultCaddy] = await Promise.all([
      readFile(join(defaultInstallDir, ".env"), "utf8"),
      readFile(join(defaultInstallDir, "configs", "homepage", "services.yaml"), "utf8"),
      readFile(join(defaultInstallDir, "configs", "caddy", "Caddyfile"), "utf8")
    ]);
    assert.match(defaultEnv, /^COMPOSE_PROFILES=monitoring,uptime,management,dns$/m);
    for (const service of ["Grafana", "Prometheus", "Uptime Kuma", "Portainer", "Pi-hole"]) {
      assert.match(defaultServices, new RegExp(service));
    }
    for (const route of ["/grafana*", "/prometheus*", "/uptime*", "/portainer*", "/pihole*"]) {
      assert.match(defaultCaddy, new RegExp(route.replace("*", "\\*")));
    }

    const interactiveDefaultInstallDir = join(tempDir, "interactive-default-stack");
    const interactiveDefaultBinDir = join(tempDir, "interactive-default-bin");
    await execFileAsync("bash", [
      "-c",
      `printf 'tailhome-default\\n\\n\\n\\n\\ny\\n' | script -qec "bash '${installer}' --skip-tailscale-install --skip-tailscale-login --skip-docker-install --no-start" /dev/null`
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: interactiveDefaultBinDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: interactiveDefaultInstallDir,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    assert.match(await readFile(join(interactiveDefaultInstallDir, ".env"), "utf8"), /^COMPOSE_PROFILES=monitoring,uptime,management,dns$/m);

    const monitoringInstallDir = join(tempDir, "monitoring-stack");
    const monitoringBinDir = join(tempDir, "monitoring-bin");
    await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-tailscale-login",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: monitoringBinDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: monitoringInstallDir,
        TAILHOME_PROFILES: "monitoring",
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });

    const [monitoringEnv, monitoringServices, monitoringCaddy] = await Promise.all([
      readFile(join(monitoringInstallDir, ".env"), "utf8"),
      readFile(join(monitoringInstallDir, "configs", "homepage", "services.yaml"), "utf8"),
      readFile(join(monitoringInstallDir, "configs", "caddy", "Caddyfile"), "utf8")
    ]);
    assert.match(monitoringEnv, /^COMPOSE_PROFILES=monitoring$/m);
    assert.match(monitoringServices, /Grafana/);
    assert.match(monitoringServices, /Prometheus/);
    assert.doesNotMatch(monitoringServices, /Uptime Kuma|Portainer|Pi-hole/);
    assert.match(monitoringCaddy, /\/grafana\*/);
    assert.match(monitoringCaddy, /\/prometheus\*/);
    assert.doesNotMatch(monitoringCaddy, /\/uptime|\/portainer|\/pihole/);

    await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-tailscale-login",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: monitoringBinDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: monitoringInstallDir,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    assert.match(await readFile(join(monitoringInstallDir, ".env"), "utf8"), /^COMPOSE_PROFILES=monitoring$/m);

    await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-tailscale-login",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: monitoringBinDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: monitoringInstallDir,
        TAILHOME_PROFILES: "",
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });
    assert.match(await readFile(join(monitoringInstallDir, ".env"), "utf8"), /^COMPOSE_PROFILES=$/m);
    assert.doesNotMatch(await readFile(join(monitoringInstallDir, "configs", "caddy", "Caddyfile"), "utf8"), /\/grafana/);

    const unknownInstallDir = join(tempDir, "unknown-profile-stack");
    await assert.rejects(
      execFileAsync("bash", [
        installer,
        "--skip-tailscale-install",
        "--skip-tailscale-login",
        "--skip-docker-install",
        "--no-start",
        "--non-interactive"
      ], {
        env: {
          ...process.env,
          NO_COLOR: "1",
          PATH: `${fakeBin}:${process.env.PATH}`,
          TAILHOME_BIN_DIR: join(tempDir, "unknown-profile-bin"),
          TAILHOME_CLI_BUILD_DIR: cliBuildDir,
          TAILHOME_DIR: unknownInstallDir,
          TAILHOME_PROFILES: "monitoring,nope",
          TAILHOME_USE_SUDO: "0"
        },
        timeout: 30_000
      }),
      /unknown service profile: nope/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("setup stack disables dns and continues when best-effort services fail", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-resilient-stack-test-"));
  const fakeBin = join(tempDir, "fake-bin");
  const cliBuildDir = join(tempDir, "cli-build");
  const installDir = join(tempDir, "stack");
  const binDir = join(tempDir, "bin");
  const dockerLog = join(tempDir, "docker.log");
  const setupStack = fileURLToPath(new URL("../../tailhome/scripts/setup-stack.sh", import.meta.url));

  await Promise.all([
    mkdir(fakeBin, { recursive: true }),
    mkdir(cliBuildDir, { recursive: true })
  ]);
  await Promise.all([
    writeFile(join(fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(fakeBin, "docker"), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "${dockerLog}"
case "$*" in
  "compose pull --policy missing"|"compose up -d homepage caddy"|"compose up -d grafana prometheus"|"compose up -d uptime-kuma"|"compose up -d portainer"|"compose rm -sf pihole"|"compose rm -sf node-exporter")
    exit 0
    ;;
  "compose up -d node-exporter")
    printf 'path / is mounted on / but it is not a shared or slave mount\\n' >&2
    exit 1
    ;;
  "compose up -d pihole")
    printf 'listen udp 0.0.0.0:53: bind: address already in use\\n' >&2
    exit 1
    ;;
  *)
    exit 1
    ;;
esac
`),
    writeFile(join(cliBuildDir, "tailhome"), "#!/usr/bin/env bash\nprintf 'fake TailHome CLI\\n'\n")
  ]);
  await Promise.all([
    chmod(join(fakeBin, "docker"), 0o755),
    chmod(join(fakeBin, "ss"), 0o755),
    chmod(join(cliBuildDir, "tailhome"), 0o755)
  ]);

  try {
    const { stderr } = await execFileAsync("bash", [setupStack], {
      env: {
        ...process.env,
        NO_COLOR: "1",
        PATH: `${fakeBin}:${process.env.PATH}`,
        TAILHOME_BIN_DIR: binDir,
        TAILHOME_CLI_BUILD_DIR: cliBuildDir,
        TAILHOME_DIR: installDir,
        TAILHOME_PROFILES: "monitoring,uptime,management,dns",
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });

    const [envFile, homepageServices, caddyFile, dockerCalls] = await Promise.all([
      readFile(join(installDir, ".env"), "utf8"),
      readFile(join(installDir, "configs", "homepage", "services.yaml"), "utf8"),
      readFile(join(installDir, "configs", "caddy", "Caddyfile"), "utf8"),
      readFile(dockerLog, "utf8")
    ]);

    assert.match(stderr, /Node Exporter could not start/);
    assert.doesNotMatch(stderr, /Pi-hole|port 53|dns profile/i);
    assert.match(envFile, /^COMPOSE_PROFILES=monitoring,uptime,management$/m);
    assert.match(homepageServices, /Grafana/);
    assert.match(homepageServices, /Uptime Kuma/);
    assert.match(homepageServices, /Portainer/);
    assert.doesNotMatch(homepageServices, /Pi-hole/);
    assert.doesNotMatch(caddyFile, /\/pihole/);
    assert.match(dockerCalls, /compose up -d homepage caddy/);
    assert.match(dockerCalls, /compose up -d grafana prometheus/);
    assert.match(dockerCalls, /compose up -d node-exporter/);
    assert.match(dockerCalls, /compose up -d pihole/);
    assert.equal(await readFile(join(installDir, ".dns-port-blocked"), "utf8"), "port53\n");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("the installer resumes a bundle after a connection reset", { skip: process.platform !== "linux" || process.arch !== "x64" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-resume-test-"));
  const packageDir = join(tempDir, "package");
  const bundleRoot = join(packageDir, "tailhome");
  const fakeCli = join(bundleRoot, "dist", "tailhome-linux-amd64");
  const archivePath = join(tempDir, "bundle.tar.gz");
  const binDir = join(tempDir, "bin");
  let archiveRequests = 0;
  let resumedAt = 0;

  await mkdir(join(bundleRoot, "dist"), { recursive: true });
  await writeFile(fakeCli, "#!/usr/bin/env bash\nprintf 'resumed TailHome CLI\\n'\n");
  await chmod(fakeCli, 0o755);
  await execFileAsync("tar", ["-czf", archivePath, "-C", packageDir, "tailhome"]);

  const archive = await readFile(archivePath);
  const checksum = createHash("sha256").update(archive).digest("hex");
  const halfway = Math.floor(archive.length / 2);
  const server = createServer((request, response) => {
    if (request.url === "/bundle.tar.gz.sha256") {
      response.end(`${checksum}  bundle.tar.gz\n`);
      return;
    }
    if (request.url !== "/bundle.tar.gz") {
      response.writeHead(404).end();
      return;
    }

    archiveRequests += 1;
    const range = request.headers.range?.match(/^bytes=(\d+)-$/);
    if (archiveRequests === 1 && !range) {
      response.writeHead(200, {
        "Accept-Ranges": "bytes",
        "Content-Length": archive.length,
        "Content-Type": "application/gzip"
      });
      response.write(archive.subarray(0, halfway));
      setTimeout(() => response.destroy(), 10);
      return;
    }

    resumedAt = Number(range?.[1] ?? 0);
    const remainder = archive.subarray(resumedAt);
    response.writeHead(206, {
      "Accept-Ranges": "bytes",
      "Content-Length": remainder.length,
      "Content-Range": `bytes ${resumedAt}-${archive.length - 1}/${archive.length}`,
      "Content-Type": "application/gzip"
    });
    response.end(remainder);
  });

  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const installer = fileURLToPath(new URL("../../../install.sh", import.meta.url));
    const { stderr } = await execFileAsync("bash", [installer, "--cli-only"], {
      env: {
        ...process.env,
        TAILHOME_BIN_DIR: binDir,
        TAILHOME_DOWNLOAD_ATTEMPTS: "3",
        TAILHOME_DOWNLOAD_RETRY_DELAY: "0",
        TAILHOME_INSTALL_URL: `http://127.0.0.1:${address.port}/bundle.tar.gz`,
        TAILHOME_USE_SUDO: "0"
      },
      timeout: 30_000
    });

    assert.ok(archiveRequests >= 2);
    assert.ok(resumedAt > 0 && resumedAt < archive.length);
    assert.match(stderr, /Resuming download at byte/);
    assert.equal(await readFile(join(binDir, "tailhome"), "utf8"), await readFile(fakeCli, "utf8"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(tempDir, { recursive: true, force: true });
  }
});
