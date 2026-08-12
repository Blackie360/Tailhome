import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./installer-command.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022
  }
});
const sourceModule = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const { installerCommandFor } = await import(sourceModule);

test("Linux web installs use one full-stack command", () => {
  const command = installerCommandFor("linux");

  assert.equal(command, "curl -fsSL https://tailhome.blackielabs.com/install.sh | bash");
  assert.doesNotMatch(command, /--cli-only|--no-start|--skip-|TAILHOME_/);
});

test("macOS web installs remain CLI-only", () => {
  assert.equal(
    installerCommandFor("macos"),
    "curl -fsSL https://tailhome.blackielabs.com/install.sh | bash -s -- --cli-only"
  );
});

test("Windows web installs remain CLI-only", () => {
  assert.equal(
    installerCommandFor("windows"),
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr https://tailhome.blackielabs.com/install.ps1 -UseB | iex"'
  );
});
