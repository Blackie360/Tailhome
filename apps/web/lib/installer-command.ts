export type InstallerPlatform = "linux" | "macos" | "windows";

const shellInstallerUrl = "https://tailhome.blackielabs.com/install.sh";
const powershellInstallerUrl = "https://tailhome.blackielabs.com/install.ps1";

export function installerCommandFor(platform: InstallerPlatform): string {
  if (platform === "windows") {
    return `powershell -NoProfile -ExecutionPolicy Bypass -Command "iwr ${powershellInstallerUrl} -UseB | iex"`;
  }

  if (platform === "macos") {
    return `curl -fsSL ${shellInstallerUrl} | bash -s -- --cli-only`;
  }

  return `curl -fsSL ${shellInstallerUrl} | bash`;
}
