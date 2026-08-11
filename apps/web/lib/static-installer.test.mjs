import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the website serves the current root shell installer", async () => {
  const [rootInstaller, staticInstaller] = await Promise.all([
    readFile(new URL("../../../install.sh", import.meta.url), "utf8"),
    readFile(new URL("../public/install.sh", import.meta.url), "utf8")
  ]);

  assert.equal(staticInstaller, rootInstaller);
});
