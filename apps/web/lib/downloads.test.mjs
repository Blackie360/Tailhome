import assert from "node:assert/strict"
import test from "node:test"
import { downloadAssetFromPath } from "./download-asset.mjs"

test("downloadAssetFromPath maps tracked installer and bundle paths", () => {
  assert.equal(downloadAssetFromPath("/install.sh"), "install.sh")
  assert.equal(downloadAssetFromPath("/install.ps1"), "install.ps1")
  assert.equal(downloadAssetFromPath("/downloads/tailhome-linux-amd64.tar.gz"), "tailhome-linux-amd64.tar.gz")
  assert.equal(downloadAssetFromPath("/downloads/tailhome-windows-amd64.exe"), "tailhome-windows-amd64.exe")
  assert.equal(downloadAssetFromPath("/downloads/tailhome-linux-amd64.tar.gz.sha256"), null)
  assert.equal(downloadAssetFromPath("/admin"), null)
})
