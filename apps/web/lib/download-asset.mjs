export function downloadAssetFromPath(pathname) {
  if (pathname === "/install.sh") {
    return "install.sh"
  }
  if (pathname === "/install.ps1") {
    return "install.ps1"
  }
  if (!pathname.startsWith("/downloads/")) {
    return null
  }
  const file = pathname.slice("/downloads/".length)
  if (!file || file.includes("/") || file.includes("..") || file.endsWith(".sha256")) {
    return null
  }
  if (file.endsWith(".tar.gz") || file.endsWith(".exe")) {
    return file
  }
  return null
}
