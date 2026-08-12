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
const { shellValue, validateCidr, validateHostname } = await import(sourceModule);

test("shell values remain one literal argument", () => {
  assert.equal(shellValue("home server"), "'home server'");
  assert.equal(shellValue("owner's-server"), "'owner'\\''s-server'");
  assert.equal(shellValue("--help"), "'--help'");
  assert.equal(shellValue("$(touch /tmp/pwned); `id`"), "'$(touch /tmp/pwned); `id`'");
});

test("hostnames follow the installer's single DNS-label constraints", () => {
  for (const hostname of ["tailhome", "Home-Server", "h", "node123"]) assert.equal(validateHostname(hostname), null);
  for (const hostname of ["", "home server", "-server", "server-", "bad.name", "x".repeat(64)]) {
    assert.notEqual(validateHostname(hostname), null);
  }
});

test("subnet routes must be IPv4 or IPv6 CIDRs", () => {
  for (const cidr of ["", "192.168.1.0/24", "0.0.0.0/0", "2001:db8::/32", "::/0"]) {
    assert.equal(validateCidr(cidr), null);
  }
  for (const cidr of ["192.168.1.0", "192.168.1.999/24", "10.0.0.0/33", "10.0.0.0/x", "2001:::1/64", "--help"]) {
    assert.notEqual(validateCidr(cidr), null);
  }
});
