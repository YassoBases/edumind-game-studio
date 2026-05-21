#!/usr/bin/env bash
# fetch_kenney.sh — mac/linux companion to fetch_kenney.ps1.
# Downloads Kenney CC0 packs, extracts them, and copies PNGs into the EduMind sprite
# library per scripts/kenney_mapping.json.
#
# Run from the repo root:
#   bash scripts/fetch_kenney.sh
#
# Prerequisites: curl, unzip, jq.
# Falls back to manual zip drop if Kenney's URL 404s.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAPPING="$SCRIPT_DIR/kenney_mapping.json"
TMPDIR="${TMPDIR:-/tmp}/edumind-kenney"
KEEP_TEMP=${KEEP_TEMP:-0}

if [[ ! -f "$MAPPING" ]]; then
  echo "ERROR: $MAPPING not found"
  exit 1
fi

for tool in curl unzip jq; do
  if ! command -v "$tool" >/dev/null; then
    echo "ERROR: $tool is required but not on PATH"
    exit 1
  fi
done

mkdir -p "$TMPDIR"
echo "Temp dir:  $TMPDIR"
echo "Repo root: $REPO_ROOT"
echo

# Default Kenney URLs (change between pack versions).
declare -A PACK_URLS=(
  [racing-pack]="https://kenney.nl/media/pages/assets/racing-pack/2cf78b8aef-1741284087/kenney_racing-pack.zip"
  [sports-pack]="https://kenney.nl/media/pages/assets/sports-pack/d2da76f7f7-1741284263/kenney_sports-pack.zip"
  [tower-defense-kit]="https://kenney.nl/media/pages/assets/tower-defense-kit/ad9a9f63a4-1741284362/kenney_tower-defense-kit.zip"
  [platformer-pack-redux]="https://kenney.nl/media/pages/assets/platformer-pack-redux/85f3776a99-1741284247/kenney_platformer-pack-redux.zip"
)

for slug in racing-pack sports-pack tower-defense-kit platformer-pack-redux; do
  url="${PACK_URLS[$slug]}"
  zip="$TMPDIR/$slug.zip"
  unzipdir="$TMPDIR/$slug"

  if [[ -d "$unzipdir" ]]; then
    echo "[$slug] already extracted, skipping"
    continue
  fi

  if [[ -f "$zip" ]]; then
    echo "[$slug] zip already present, skipping download"
  else
    echo "[$slug] downloading $url ..."
    if ! curl -fSL --retry 2 -o "$zip" "$url"; then
      echo "[$slug] direct download failed."
      echo
      echo "  ⚠ Kenney's CDN URLs change between pack versions."
      echo "    1. Open https://kenney.nl/assets/$slug in a browser."
      echo "    2. Click 'Download' (the CC0 free zip)."
      echo "    3. Save the zip as $zip"
      echo "    4. Re-run this script."
      echo
      continue
    fi
  fi

  echo "[$slug] extracting to $unzipdir ..."
  mkdir -p "$unzipdir"
  unzip -q -o "$zip" -d "$unzipdir" || { echo "[$slug] unzip failed"; continue; }
done

# Build an index of all PNGs (relative-to-pack-root key + a basename-only fallback).
INDEX_FILE="$TMPDIR/_index.txt"
: > "$INDEX_FILE"
for slug in racing-pack sports-pack tower-defense-kit platformer-pack-redux; do
  unzipdir="$TMPDIR/$slug"
  [[ -d "$unzipdir" ]] || continue
  while IFS= read -r -d '' f; do
    rel="${f#$unzipdir/}"
    echo -e "$rel\t$f" >> "$INDEX_FILE"
    base="$(basename "$f")"
    echo -e "::base::$base\t$f" >> "$INDEX_FILE"
  done < <(find "$unzipdir" -name '*.png' -type f -print0)
done

count_index=$(wc -l < "$INDEX_FILE")
echo
echo "Indexed $count_index sources from extracted packs"
echo

# Helper to look up a source path. Echoes the absolute path, or empty if not found.
lookup() {
  local key="$1"
  # exact relative match
  local hit
  hit="$(awk -F'\t' -v k="$key" '$1 == k {print $2; exit}' "$INDEX_FILE")"
  if [[ -n "$hit" ]]; then echo "$hit"; return; fi
  # basename fallback
  local base
  base="$(basename "$key")"
  awk -F'\t' -v k="::base::$base" '$1 == k {print $2; exit}' "$INDEX_FILE"
}

# Apply the mapping
copied=0
missing=()
while IFS= read -r entry; do
  dest_rel="$(jq -r '.to // empty' <<< "$entry")"
  [[ -z "$dest_rel" ]] && continue
  dest="$REPO_ROOT/$dest_rel"
  mkdir -p "$(dirname "$dest")"

  found=""
  while IFS= read -r candidate; do
    src="$(lookup "$candidate")"
    if [[ -n "$src" ]]; then found="$src"; break; fi
  done < <(jq -r '.from[]?' <<< "$entry")

  if [[ -n "$found" ]]; then
    cp -f "$found" "$dest"
    copied=$((copied + 1))
  else
    candidates_csv="$(jq -r '.from | join(", ")' <<< "$entry")"
    missing+=("$dest_rel | tried: $candidates_csv")
  fi
done < <(jq -c '.mappings[]' "$MAPPING")

echo "=========================================="
echo "Copied: $copied"
echo "Missing (loader falls back to programmatic SVG): ${#missing[@]}"
if (( ${#missing[@]} > 0 )); then
  echo
  echo "Missing roles:"
  for m in "${missing[@]}"; do
    echo "  $m"
  done
  echo
  echo "  If you want to fix these:"
  echo "    1. Look in the extracted packs under $TMPDIR"
  echo "    2. Find a sensible PNG for each missing role"
  echo "    3. Add an entry to scripts/kenney_mapping.json"
  echo "    4. Re-run this script."
fi

if [[ "$KEEP_TEMP" != "1" ]]; then
  echo
  echo "Cleaning $TMPDIR (set KEEP_TEMP=1 to retain extracted packs)..."
  rm -rf "$TMPDIR"
fi

echo
echo "✓ Done. Now commit the new sprites and push."
echo "  Backend loader picks them up automatically — no code change needed."
echo "  Verify by generating a lane_racer game and checking EduSprites.library in the scaffold."
