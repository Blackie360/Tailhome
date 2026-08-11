import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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

test("the hosted bundle contains the installer and every supported CLI", async () => {
  const archive = new URL("../public/tailhome.tar.gz", import.meta.url);
  const { stdout } = await execFileAsync("tar", ["-tzf", archive.pathname]);
  const entries = new Set(stdout.trim().split("\n"));

  for (const entry of [
    "tailhome/install.sh",
    "tailhome/docker-compose.yml",
    "tailhome/scripts/setup-stack.sh",
    "tailhome/dist/tailhome-linux-amd64",
    "tailhome/dist/tailhome-linux-arm64",
    "tailhome/dist/tailhome-linux-armv7",
    "tailhome/dist/tailhome-linux-armv6",
    "tailhome/dist/tailhome-darwin-amd64",
    "tailhome/dist/tailhome-darwin-arm64",
    "tailhome/dist/tailhome-windows-amd64.exe",
    "tailhome/dist/tailhome-windows-arm64.exe"
  ]) {
    assert.ok(entries.has(entry), `missing bundle entry: ${entry}`);
  }

  const [{ stdout: bundledInstaller }, appInstaller] = await Promise.all([
    execFileAsync("tar", ["-xOzf", archive.pathname, "tailhome/install.sh"]),
    readFile(new URL("../../tailhome/install.sh", import.meta.url), "utf8")
  ]);
  assert.equal(bundledInstaller, appInstaller, "the bundled app installer is stale");
});

test("the hosted bundle checksum matches", async () => {
  const [archive, checksum] = await Promise.all([
    readFile(new URL("../public/tailhome.tar.gz", import.meta.url)),
    readFile(new URL("../public/tailhome.tar.gz.sha256", import.meta.url), "utf8")
  ]);
  const expected = checksum.trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(archive).digest("hex");
  assert.equal(actual, expected);
});

test("the installer is safe to stream into bash", async () => {
  const installer = await readFile(new URL("../../../install.sh", import.meta.url), "utf8");
  assert.match(installer, /SCRIPT_SOURCE="\$\{BASH_SOURCE\[0\]-\}"/);
  assert.doesNotMatch(installer, /archive\/\$\{REF\}\.tar\.gz/);
  assert.match(installer, /tailhome\.tar\.gz/);
});
