param(
  [string]$Version = $env:TAILHOME_INSTALL_VERSION,
  [string]$BinDir = $env:TAILHOME_BIN_DIR,
  [string]$CliUrl = $env:TAILHOME_CLI_URL,
  [switch]$NoPathUpdate
)

$ErrorActionPreference = "Stop"
$TailHomeVersion = "0.1.0"
$Repo = if ($env:TAILHOME_INSTALL_REPO) { $env:TAILHOME_INSTALL_REPO } else { "Blackie360/Tailhome" }

if (-not $Version) {
  $Version = "v$TailHomeVersion"
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
  $CliUrl = "https://github.com/$Repo/releases/download/$Version/tailhome-windows-$arch.exe"
}

New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
$target = Join-Path $BinDir "tailhome.exe"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) "tailhome-$arch.exe"

Write-Host "Downloading TailHome CLI from $CliUrl"
Invoke-WebRequest -Uri $CliUrl -OutFile $tmp
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
