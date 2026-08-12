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

test("port checks only include enabled service profiles", { skip: process.platform !== "linux" }, async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "tailhome-port-profile-test-"));
  const fakeBin = join(tempDir, "bin");
  const fakeSs = join(fakeBin, "ss");
  const checker = fileURLToPath(new URL("../../tailhome/scripts/check-ports.sh", import.meta.url));

  await mkdir(fakeBin, { recursive: true });
  await writeFile(fakeSs, "#!/usr/bin/env bash\nprintf 'LISTEN 0 4096 0.0.0.0:53 0.0.0.0:*\\nLISTEN 0 4096 0.0.0.0:3000 0.0.0.0:*\\nLISTEN 0 4096 0.0.0.0:3001 0.0.0.0:*\\n'\n");
  await chmod(fakeSs, 0o755);

  try {
    let output = "";
    try {
      await execFileAsync("bash", [checker], {
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, TAILHOME_PROFILES: "" }
      });
    } catch (error) {
      output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    }
    assert.match(output, /\[busy\] tcp\/3000/);
    assert.doesNotMatch(output, /\[busy\] (tcp|udp)\/53|\[busy\] tcp\/3001/);

    try {
      await execFileAsync("bash", [checker], {
        env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}`, TAILHOME_PROFILES: "monitoring,dns" }
      });
    } catch (error) {
      output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    }
    assert.match(output, /\[busy\] tcp\/3001/);
    assert.match(output, /\[busy\] tcp\/53/);
    assert.match(output, /\[busy\] udp\/53/);
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
    writeFile(join(fakeBin, "ss"), "#!/usr/bin/env bash\nprintf 'LISTEN 0 4096 0.0.0.0:53 0.0.0.0:*\\n'\n"),
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
    assert.match(output, /skipping port check because services will not start/);
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
