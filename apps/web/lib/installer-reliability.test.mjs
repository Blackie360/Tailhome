import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const setupStack = fileURLToPath(new URL("../../tailhome/scripts/setup-stack.sh", import.meta.url));
const installer = fileURLToPath(new URL("../../tailhome/install.sh", import.meta.url));
const composeSource = fileURLToPath(new URL("../../tailhome/docker-compose.yml", import.meta.url));
const portVariables = [
  "TAILHOME_HOMEPAGE_PORT",
  "TAILHOME_GRAFANA_PORT",
  "TAILHOME_UPTIME_PORT",
  "TAILHOME_CADDY_HTTP_PORT",
  "TAILHOME_CADDY_HTTPS_PORT",
  "TAILHOME_PROMETHEUS_PORT",
  "TAILHOME_NODE_EXPORTER_PORT",
  "TAILHOME_PORTAINER_PORT",
  "TAILHOME_PIHOLE_WEB_PORT"
];

function parseEnv(content) {
  return Object.fromEntries(content.trim().split("\n").filter(Boolean).map((line) => line.split(/=(.*)/s).slice(0, 2)));
}

async function makeFixture(prefix = "tailhome-reliability-") {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const fakeBin = join(root, "fake-bin");
  const cliBuildDir = join(root, "cli-build");
  const installDir = join(root, "stack");
  const binDir = join(root, "bin");
  const dockerLog = join(root, "docker.log");
  await Promise.all([mkdir(fakeBin, { recursive: true }), mkdir(cliBuildDir, { recursive: true })]);
  await Promise.all([
    writeFile(join(fakeBin, "docker"), `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${dockerLog}"
[[ "$*" == "compose config" || "$*" == "compose version" || "$*" == "compose ps" || "$*" == "compose up -d homepage caddy pihole" ]]
`),
    writeFile(join(cliBuildDir, "tailhome"), "#!/usr/bin/env bash\nprintf 'fake TailHome CLI\\n'\n")
  ]);
  await Promise.all([chmod(join(fakeBin, "docker"), 0o755), chmod(join(cliBuildDir, "tailhome"), 0o755)]);
  return { root, fakeBin, cliBuildDir, installDir, binDir, dockerLog };
}

function setupEnv(fixture, extra = {}) {
  const env = {
    ...process.env,
    NO_COLOR: "1",
    PATH: `${fixture.fakeBin}:${process.env.PATH}`,
    TAILHOME_BIN_DIR: fixture.binDir,
    TAILHOME_CLI_BUILD_DIR: fixture.cliBuildDir,
    TAILHOME_DIR: fixture.installDir,
    TAILHOME_NO_START: "1",
    TAILHOME_PROFILES: "monitoring,uptime,management,dns",
    TAILHOME_USE_SUDO: "0",
    ...extra
  };
  for (const [name, value] of Object.entries(env)) {
    if (value === undefined) delete env[name];
  }
  return env;
}

test("occupied defaults allocate unique ports and every generated consumer agrees across reruns", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture();
  const healthLog = join(fixture.root, "health.log");
  const occupied = [3000, 3001, 3002, 8080, 8088, 8443, 9090, 9100, 9443];
  await writeFile(join(fixture.fakeBin, "ss"), `#!/usr/bin/env bash
if [[ "$*" == *"-ltn"* ]]; then
${occupied.map((port) => `  printf 'LISTEN 0 4096 0.0.0.0:${port} 0.0.0.0:*\\n'`).join("\n")}
fi
`);
  await chmod(join(fixture.fakeBin, "ss"), 0o755);

  try {
    await execFileAsync("bash", [setupStack], { env: setupEnv(fixture), timeout: 30_000 });
    const firstEnvText = await readFile(join(fixture.installDir, ".env"), "utf8");
    const firstEnv = parseEnv(firstEnvText);
    const resolved = portVariables.map((name) => firstEnv[name]);
    assert.equal(new Set(resolved).size, resolved.length, "resolved ports must be unique");
    assert.ok(Number(firstEnv.TAILHOME_HOMEPAGE_PORT) > 3001);
    assert.ok(Number(firstEnv.TAILHOME_GRAFANA_PORT) > Number(firstEnv.TAILHOME_HOMEPAGE_PORT));

    const [compose, homepage, caddy, prometheus, health] = await Promise.all([
      readFile(join(fixture.installDir, "docker-compose.yml"), "utf8"),
      readFile(join(fixture.installDir, "configs", "homepage", "services.yaml"), "utf8"),
      readFile(join(fixture.installDir, "configs", "caddy", "Caddyfile"), "utf8"),
      readFile(join(fixture.installDir, "configs", "prometheus", "prometheus.yml"), "utf8"),
      readFile(join(fixture.installDir, "scripts", "health-check.sh"), "utf8")
    ]);
    for (const variable of portVariables) assert.match(compose, new RegExp(`\\$\\{${variable}`));
    assert.match(homepage, new RegExp(`:${firstEnv.TAILHOME_GRAFANA_PORT}`));
    assert.match(homepage, new RegExp(`:${firstEnv.TAILHOME_PIHOLE_WEB_PORT}/admin`));
    assert.match(caddy, new RegExp(`:${firstEnv.TAILHOME_PROMETHEUS_PORT}`));
    assert.match(prometheus, new RegExp(`host\\.docker\\.internal:${firstEnv.TAILHOME_NODE_EXPORTER_PORT}`));
    for (const variable of portVariables.filter((name) => name !== "TAILHOME_CADDY_HTTPS_PORT")) {
      assert.match(health, new RegExp(variable));
    }

    await Promise.all([
      writeFile(join(fixture.fakeBin, "curl"), `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${healthLog}"
exit 0
`),
      writeFile(join(fixture.fakeBin, "systemctl"), "#!/usr/bin/env bash\nexit 0\n")
    ]);
    await Promise.all([chmod(join(fixture.fakeBin, "curl"), 0o755), chmod(join(fixture.fakeBin, "systemctl"), 0o755)]);
    await execFileAsync("bash", [join(fixture.installDir, "scripts", "health-check.sh")], {
      env: setupEnv(fixture, { TAILHOME_HEALTH_ATTEMPTS: "1" }),
      timeout: 30_000
    });
    const probes = await readFile(healthLog, "utf8");
    for (const name of ["TAILHOME_HOMEPAGE_PORT", "TAILHOME_GRAFANA_PORT", "TAILHOME_PROMETHEUS_PORT", "TAILHOME_NODE_EXPORTER_PORT"]) {
      assert.match(probes, new RegExp(`127\\.0\\.0\\.1:${firstEnv[name]}`));
    }

    await writeFile(join(fixture.fakeBin, "ss"), `#!/usr/bin/env bash
if [[ "$*" == *"-ltn"* ]]; then
${resolved.map((port) => `  printf 'LISTEN 0 4096 0.0.0.0:${port} 0.0.0.0:*\\n'`).join("\n")}
fi
`);
    await chmod(join(fixture.fakeBin, "ss"), 0o755);
    await execFileAsync("bash", [setupStack], { env: setupEnv(fixture, { TAILHOME_PROFILES: undefined }), timeout: 30_000 });
    const secondEnv = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    for (const variable of portVariables) assert.equal(secondEnv[variable], firstEnv[variable]);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("explicit free ports are preserved", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-explicit-ports-");
  await writeFile(join(fixture.fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n");
  await chmod(join(fixture.fakeBin, "ss"), 0o755);
  const explicit = Object.fromEntries(portVariables.map((name, index) => [name, String(12000 + index)]));
  try {
    await execFileAsync("bash", [setupStack], { env: setupEnv(fixture, explicit), timeout: 30_000 });
    const values = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    for (const variable of portVariables) assert.equal(values[variable], explicit[variable]);
    await assert.rejects(readFile(join(fixture.installDir, ".port-adjustments"), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("host-wide TCP or UDP port 53 disables only DNS and tailhome enable dns restores it", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-dns-");
  const fakeSs = join(fixture.fakeBin, "ss");
  await writeFile(fakeSs, `#!/usr/bin/env bash
if [[ "$*" == *"-ltn"* ]]; then
  printf 'LISTEN 0 4096 0.0.0.0:53 0.0.0.0:*\n'
else
  printf 'UNCONN 0 0 [::]:53 [::]:*\n'
fi
`);
  await chmod(fakeSs, 0o755);
  try {
    await execFileAsync("bash", [setupStack], { env: setupEnv(fixture), timeout: 30_000 });
    let values = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    assert.equal(values.COMPOSE_PROFILES, "monitoring,uptime,management");
    assert.equal(await readFile(join(fixture.installDir, ".dns-port-blocked"), "utf8"), "port53\n");
    assert.doesNotMatch(await readFile(join(fixture.installDir, "configs", "homepage", "services.yaml"), "utf8"), /Pi-hole/);
    assert.match(await readFile(join(fixture.installDir, "configs", "homepage", "services.yaml"), "utf8"), /Grafana|Uptime Kuma|Portainer/);

    await writeFile(fakeSs, "#!/usr/bin/env bash\nexit 0\n");
    await chmod(fakeSs, 0o755);
    await execFileAsync("bash", [join(fixture.installDir, "scripts", "enable-dns.sh")], {
      env: setupEnv(fixture, { TAILHOME_NO_START: undefined }),
      timeout: 30_000
    });
    values = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    assert.equal(values.COMPOSE_PROFILES, "monitoring,uptime,management,dns");
    assert.match(await readFile(join(fixture.installDir, "configs", "homepage", "services.yaml"), "utf8"), /Pi-hole/);
    await assert.rejects(readFile(join(fixture.installDir, ".dns-port-blocked"), "utf8"), { code: "ENOENT" });
    assert.match(await readFile(fixture.dockerLog, "utf8"), /compose up -d homepage caddy pihole/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("loopback-only systemd-resolved listeners keep DNS eligible", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-loopback-dns-");
  await writeFile(join(fixture.fakeBin, "ss"), `#!/usr/bin/env bash
if [[ "$*" == *"-ltn"* ]]; then
  printf 'LISTEN 0 4096 127.0.0.53:53 0.0.0.0:*\n'
else
  printf 'UNCONN 0 0 127.0.0.54:53 0.0.0.0:*\n'
fi
`);
  await chmod(join(fixture.fakeBin, "ss"), 0o755);
  try {
    await execFileAsync("bash", [setupStack], { env: setupEnv(fixture), timeout: 30_000 });
    const values = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    assert.match(values.COMPOSE_PROFILES, /(?:^|,)dns(?:,|$)/);
    await assert.rejects(readFile(join(fixture.installDir, ".dns-port-blocked"), "utf8"), { code: "ENOENT" });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("pseudo-TTY install silently reallocates collisions and reports them only in the final summary", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-pty-ports-");
  await writeFile(join(fixture.fakeBin, "ss"), `#!/usr/bin/env bash
if [[ "$*" == *"-ltn"* ]]; then
  printf 'LISTEN 0 4096 0.0.0.0:3000 0.0.0.0:*\n'
  printf 'LISTEN 0 4096 0.0.0.0:3001 0.0.0.0:*\n'
  printf 'LISTEN 0 4096 0.0.0.0:53 0.0.0.0:*\n'
else
  printf 'UNCONN 0 0 0.0.0.0:53 0.0.0.0:*\n'
fi
`);
  await chmod(join(fixture.fakeBin, "ss"), 0o755);
  try {
    const command = `printf 'homebase\\n\\n\\n\\n\\ny\\n' | script -qec "bash '${installer}' --skip-tailscale-install --skip-tailscale-login --skip-docker-install --no-start" /dev/null`;
    const { stdout, stderr } = await execFileAsync("bash", ["-c", command], {
      env: setupEnv(fixture, { TAILHOME_NO_START: undefined, TAILHOME_PROFILES: undefined }),
      timeout: 30_000
    });
    const output = `${stdout}\n${stderr}`;
    const values = parseEnv(await readFile(join(fixture.installDir, ".env"), "utf8"));
    assert.notEqual(values.TAILHOME_HOMEPAGE_PORT, "3000");
    assert.notEqual(values.TAILHOME_GRAFANA_PORT, "3001");
    assert.match(output, /✓ TailHome is ready/);
    assert.match(output, /Automatically adjusted/);
    assert.match(output, new RegExp(`Homepage\\s+3000 -> ${values.TAILHOME_HOMEPAGE_PORT}`));
    assert.match(output, new RegExp(`Homepage\\s+http://homebase:${values.TAILHOME_HOMEPAGE_PORT}`));
    assert.match(output, /Tailscale\s+connection pending/);
    assert.match(output, /tailhome connect/);
    assert.match(output, /Pi-hole DNS was not started because port 53 is occupied\.[\s\S]*tailhome enable dns/);
    assert.doesNotMatch(output, /Pi-hole\s+http:/);
    assert.doesNotMatch(output.split("Automatically adjusted")[0], /\[busy\]|port 3000.*occupied|3000 ->/i);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("tailscaled service failure never aborts TailHome installation", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-tailscale-failure-");
  await Promise.all([
    writeFile(join(fixture.fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(fixture.fakeBin, "tailscale"), "#!/usr/bin/env bash\nexit 1\n"),
    writeFile(join(fixture.fakeBin, "systemctl"), `#!/usr/bin/env bash
[[ "$*" == "daemon-reload" ]] && exit 0
printf 'synthetic tailscaled startup failure\n' >&2
exit 1
`)
  ]);
  await Promise.all([
    chmod(join(fixture.fakeBin, "ss"), 0o755),
    chmod(join(fixture.fakeBin, "tailscale"), 0o755),
    chmod(join(fixture.fakeBin, "systemctl"), 0o755)
  ]);
  try {
    const { stdout, stderr } = await execFileAsync("bash", [
      installer,
      "--skip-tailscale-login",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: setupEnv(fixture, {
        TAILHOME_NO_START: undefined,
        TAILHOME_SYSTEMD_DIR: join(fixture.root, "systemd")
      }),
      timeout: 30_000
    });
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /✓ TailHome is ready/);
    assert.match(output, /Tailscale\s+connection pending/);
    assert.doesNotMatch(output, /synthetic tailscaled startup failure/);
    assert.match(await readFile(join(fixture.installDir, ".tailscale-diagnostic"), "utf8"), /could not enable and start tailscaled/);
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("connected Tailscale state is reported without a login attempt", { skip: process.platform !== "linux" }, async () => {
  const fixture = await makeFixture("tailhome-tailscale-connected-");
  const tailscaleLog = join(fixture.root, "tailscale.log");
  await Promise.all([
    writeFile(join(fixture.fakeBin, "ss"), "#!/usr/bin/env bash\nexit 0\n"),
    writeFile(join(fixture.fakeBin, "tailscale"), `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${tailscaleLog}"
[[ "$*" == "status --json" ]] && printf '{"BackendState":"Running"}\n'
`)
  ]);
  await Promise.all([chmod(join(fixture.fakeBin, "ss"), 0o755), chmod(join(fixture.fakeBin, "tailscale"), 0o755)]);
  try {
    const { stdout, stderr } = await execFileAsync("bash", [
      installer,
      "--skip-tailscale-install",
      "--skip-docker-install",
      "--no-start",
      "--non-interactive"
    ], {
      env: setupEnv(fixture, { TAILHOME_NO_START: undefined }),
      timeout: 30_000
    });
    const output = `${stdout}\n${stderr}`;
    assert.match(output, /Tailscale\s+connected/);
    assert.doesNotMatch(output, /tailhome connect/);
    assert.equal(await readFile(tailscaleLog, "utf8"), "status --json\n");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("public tracked and generated text contains no private Tailscale hostname", async () => {
  const { stdout } = await execFileAsync("git", ["ls-files"], { cwd: fileURLToPath(new URL("../../..", import.meta.url)) });
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const textExtensions = /(?:\.md|\.sh|\.ps1|\.go|\.yml|\.yaml|\.json|\.mjs|\.ts|\.tsx|\.css|\.example)$/;
  const files = stdout.trim().split("\n").filter((file) => textExtensions.test(file));
  const privateHostname = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net\b/i;
  for (const file of files) {
    const content = await readFile(join(root, file), "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    assert.doesNotMatch(content, privateHostname, `private Tailscale hostname leaked in ${file}`);
  }
  const bundles = stdout.trim().split("\n").filter((file) => file.startsWith("apps/web/public/downloads/") && file.endsWith(".tar.gz"));
  for (const bundle of bundles) {
    const archive = join(root, bundle);
    const { stdout: listing } = await execFileAsync("tar", ["-tzf", archive]);
    const publicTextEntries = listing.trim().split("\n").filter((entry) => entry && !entry.endsWith("/") && !entry.startsWith("tailhome/dist/"));
    for (const entry of publicTextEntries) {
      const { stdout: content } = await execFileAsync("tar", ["-xOzf", archive, entry], { encoding: "utf8", maxBuffer: 2_000_000 });
      assert.doesNotMatch(content, privateHostname, `private Tailscale hostname leaked in ${bundle}:${entry}`);
    }
  }
  assert.match(await readFile(composeSource, "utf8"), /TAILHOME_HOMEPAGE_PORT/);
});
