param(
  [string]$BinDir = $env:TAILHOME_BIN_DIR,
  [string]$CliUrl = $env:TAILHOME_CLI_URL,
  [string]$Origin = $env:TAILHOME_ORIGIN,
  [switch]$NoPathUpdate
)

$ErrorActionPreference = "Stop"
$TailHomeVersion = "0.1.0"

if (-not $Origin) {
  $Origin = "https://tailhome.blackielabs.com"
}

if (-not $BinDir) {
  $BinDir = Join-Path $env:LOCALAPPDATA "TailHome\bin"
}

$arch = switch ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture) {
  "X64" { "amd64" }
  "Arm64" { "arm64" }
  default { throw "Unsupported architecture: $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)" }
}

if (-not $CliUrl) {
  $CliUrl = "$Origin/downloads/tailhome-windows-$arch.exe"
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$target = Join-Path $BinDir "tailhome.exe"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "tailhome-$arch.exe"
$checksumTmp = "$tmp.sha256"

Write-Host "Downloading TailHome CLI from $CliUrl"
Invoke-WebRequest -Uri $CliUrl -OutFile $tmp

try {
  Invoke-WebRequest -Uri "$CliUrl.sha256" -OutFile $checksumTmp
  $expected = ((Get-Content $checksumTmp -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 $tmp).Hash.ToLowerInvariant()
  if ($expected -ne $actual) {
    throw "TailHome CLI checksum verification failed"
  }
} catch {
  Remove-Item -Force -ErrorAction SilentlyContinue $tmp
  throw
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $checksumTmp
}

Move-Item -Force $tmp $target

if (-not $NoPathUpdate) {
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $paths = if ($userPath) { $userPath -split ";" } else { @() }
  if ($paths -notcontains $BinDir) {
    $newPath = if ($userPath) { "$userPath;$BinDir" } else { $BinDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$BinDir"
    Write-Host "Added $BinDir to your user PATH. Open a new terminal if tailhome is not found."
  }
}

Write-Host "TailHome CLI installed at $target"
Write-Host "The full TailHome Docker stack installer is Linux-only. This Windows installer installs the CLI."
