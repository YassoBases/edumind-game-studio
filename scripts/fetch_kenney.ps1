# fetch_kenney.ps1 — download Kenney CC0 packs, extract them, and copy PNGs into the
# EduMind sprite library per scripts/kenney_mapping.json.
#
# Run from the repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/fetch_kenney.ps1
#
# Prerequisites: PowerShell 5.1+ (ships with Windows 10/11). No extra tooling needed —
# uses Invoke-WebRequest + Expand-Archive + Copy-Item.
#
# Kenney's download URLs change between pack versions. If a direct download 404s, the
# script tells you which pack page to visit and where to drop the zip. The mapping JSON
# is forgiving — multiple source paths per role, first one found wins.

[CmdletBinding()]
param(
  [string] $TempDir = "$env:TEMP\edumind-kenney",
  [switch] $KeepTemp
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$MappingFile = Join-Path $PSScriptRoot "kenney_mapping.json"
if (-not (Test-Path $MappingFile)) {
  Write-Host "ERROR: $MappingFile not found. Run from repo root." -ForegroundColor Red
  exit 1
}

# Best-effort default Kenney URLs (these change with each pack version).
# If a URL 404s, the script prints fallback instructions.
$Packs = @(
  @{ Slug = "racing-pack";           Url = "https://kenney.nl/media/pages/assets/racing-pack/2cf78b8aef-1741284087/kenney_racing-pack.zip" },
  @{ Slug = "sports-pack";           Url = "https://kenney.nl/media/pages/assets/sports-pack/d2da76f7f7-1741284263/kenney_sports-pack.zip" },
  @{ Slug = "tower-defense-kit";     Url = "https://kenney.nl/media/pages/assets/tower-defense-kit/ad9a9f63a4-1741284362/kenney_tower-defense-kit.zip" },
  @{ Slug = "platformer-pack-redux"; Url = "https://kenney.nl/media/pages/assets/platformer-pack-redux/85f3776a99-1741284247/kenney_platformer-pack-redux.zip" }
)

# Create temp dir
if (-not (Test-Path $TempDir)) { New-Item -ItemType Directory -Path $TempDir -Force | Out-Null }
Write-Host "Temp dir: $TempDir" -ForegroundColor Cyan
Write-Host "Repo root: $RepoRoot" -ForegroundColor Cyan
Write-Host ""

# Download each pack (or prompt the user to do it manually if the URL 404s).
foreach ($pack in $Packs) {
  $slug = $pack.Slug
  $url = $pack.Url
  $zip = Join-Path $TempDir "$slug.zip"
  $unzipDir = Join-Path $TempDir $slug

  if (Test-Path $unzipDir) {
    Write-Host "[$slug] already extracted, skipping download" -ForegroundColor Yellow
    continue
  }

  if (Test-Path $zip) {
    Write-Host "[$slug] zip already present, skipping download" -ForegroundColor Yellow
  } else {
    Write-Host "[$slug] downloading from $url ..."
    try {
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
    } catch {
      Write-Host "[$slug] direct download failed: $($_.Exception.Message)" -ForegroundColor Yellow
      Write-Host ""
      Write-Host "  ⚠ Kenney's CDN URLs change between pack versions." -ForegroundColor Yellow
      Write-Host "    1. Open https://kenney.nl/assets/$slug in a browser."
      Write-Host "    2. Click 'Download' (the CC0 free zip)."
      Write-Host "    3. Save the zip as $zip"
      Write-Host "    4. Re-run this script. It will skip re-downloading."
      Write-Host ""
      continue
    }
  }

  Write-Host "[$slug] extracting to $unzipDir ..."
  if (-not (Test-Path $unzipDir)) { New-Item -ItemType Directory -Path $unzipDir -Force | Out-Null }
  try {
    Expand-Archive -Path $zip -DestinationPath $unzipDir -Force
  } catch {
    Write-Host "[$slug] extraction failed: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }
}

# Build a flat index of every PNG inside each extracted pack.
# Use a forward-slash relative-to-pack-root key so the mapping JSON entries match
# regardless of Kenney's nested subfolder conventions.
$Index = @{}
foreach ($pack in $Packs) {
  $unzipDir = Join-Path $TempDir $pack.Slug
  if (-not (Test-Path $unzipDir)) { continue }
  $files = Get-ChildItem -Path $unzipDir -Filter *.png -Recurse -File -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($unzipDir.Length).TrimStart('\','/').Replace('\','/')
    if (-not $Index.ContainsKey($rel)) { $Index[$rel] = $f.FullName }
    # Also index by basename so mappings can match by filename only when subdirs differ
    $base = $f.Name
    $byBase = "::base::$base"
    if (-not $Index.ContainsKey($byBase)) { $Index[$byBase] = $f.FullName }
  }
}
Write-Host ""
Write-Host "Indexed $($Index.Count) sources from extracted packs" -ForegroundColor Cyan
Write-Host ""

# Load mapping and copy
$mappingJson = Get-Content $MappingFile -Raw | ConvertFrom-Json
$copied = 0
$missing = @()

foreach ($entry in $mappingJson.mappings) {
  if (-not $entry.to) { continue }
  $dest = Join-Path $RepoRoot ($entry.to -replace '/','\')
  $destDir = Split-Path $dest -Parent
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

  $sourcePath = $null
  foreach ($candidate in $entry.from) {
    $key = $candidate.Replace('\','/')
    if ($Index.ContainsKey($key)) { $sourcePath = $Index[$key]; break }
    # fallback to basename match
    $base = Split-Path $candidate -Leaf
    $byBase = "::base::$base"
    if ($Index.ContainsKey($byBase)) { $sourcePath = $Index[$byBase]; break }
  }

  if ($sourcePath) {
    Copy-Item -Path $sourcePath -Destination $dest -Force
    $copied += 1
  } else {
    $missing += @{ to = $entry.to; from = $entry.from }
  }
}

# Summary
Write-Host "=========================================="
Write-Host "Copied: $copied" -ForegroundColor Green
Write-Host "Missing (loader falls back to programmatic SVG): $($missing.Count)" -ForegroundColor Yellow
if ($missing.Count -gt 0) {
  Write-Host ""
  Write-Host "Missing roles:"
  foreach ($m in $missing) {
    $candidatesStr = ($m.from -join ', ')
    Write-Host "  $($m.to)"
    Write-Host "    tried: $candidatesStr" -ForegroundColor DarkGray
  }
  Write-Host ""
  Write-Host "  If you want to fix these:"
  Write-Host "    1. Open the extracted pack folders under $TempDir"
  Write-Host "    2. Find a sensible PNG for each missing role"
  Write-Host "    3. Add an entry to scripts/kenney_mapping.json with the correct source path"
  Write-Host "    4. Re-run this script."
}

if (-not $KeepTemp) {
  Write-Host ""
  Write-Host "Cleaning $TempDir (pass -KeepTemp to retain extracted packs)..."
  Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "✓ Done. Now commit the new sprites and push." -ForegroundColor Green
Write-Host "  Backend loader picks them up automatically — no code change needed."
Write-Host "  Verify by generating a lane_racer game and checking EduSprites.library in the scaffold."
