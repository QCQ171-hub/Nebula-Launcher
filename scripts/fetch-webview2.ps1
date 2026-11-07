# Fetch the Microsoft Edge WebView2 Fixed Version runtime (x64) and unpack it
# into .\webview2, so Nebula Launcher can run without installing the system
# runtime and without administrator rights.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\fetch-webview2.ps1
#
# The launcher looks for msedgewebview2.exe in these places (in order):
#   1. %WEBVIEW2_BROWSER_EXECUTABLE_FOLDER% if already set
#   2. <exe dir>\webview2, <exe dir>\resources\webview2 (and up to 3 parent dirs)
#   3. the system-installed Evergreen runtime
# See src-tauri/src/main.rs for the exact lookup logic.

param(
    [string]$Version = "151.0.4129.93",
    [string]$Url = "https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/1424552f-1033-46d3-a1ea-26c879f4262b/Microsoft.WebView2.FixedVersionRuntime.151.0.4129.93.x64.cab",
    [string]$Sha256 = "1cb7106545f5aee92ee16496347a0e775a351cb5a3816d072f04323695899bde"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root "webview2"
$work = Join-Path $root ".webview2-download"
$cab = Join-Path $work "wv2.cab"
$extract = Join-Path $work "extract"

if (Test-Path (Join-Path $target "msedgewebview2.exe")) {
    Write-Host "WebView2 runtime already present: $target"
    exit 0
}

New-Item -ItemType Directory -Force -Path $work | Out-Null
New-Item -ItemType Directory -Force -Path $extract | Out-Null

Write-Host "Downloading WebView2 Fixed Version $Version ..."
Write-Host "  $Url"
Invoke-WebRequest -Uri $Url -OutFile $cab -UseBasicParsing

$hash = (Get-FileHash $cab -Algorithm SHA256).Hash.ToLower()
Write-Host "SHA256: $hash"
if ($Sha256 -and $hash -ne $Sha256.ToLower()) {
    Remove-Item $cab -Force
    throw "Checksum mismatch. Expected $Sha256 but got $hash. Aborted."
}

Write-Host "Expanding package ..."
& "$env:SystemRoot\System32\expand.exe" -F:* $cab $extract | Out-Null

$inner = Get-ChildItem $extract -Directory | Select-Object -First 1
if (-not $inner) {
    throw "Expanded folder not found. The cab layout may have changed."
}
if (-not (Test-Path (Join-Path $inner.FullName "msedgewebview2.exe"))) {
    throw "msedgewebview2.exe missing from the expanded package."
}

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Move-Item $inner.FullName $target
Remove-Item $work -Recurse -Force

$size = [math]::Round(((Get-ChildItem $target -Recurse -File | Measure-Object Length -Sum).Sum / 1MB), 0)
Write-Host "Done. Runtime unpacked to $target ($size MB)."
