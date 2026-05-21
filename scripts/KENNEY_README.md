# Fetching Kenney CC0 sprite packs

EduMind generates games with themed visuals (cars, footballs, castles, hero characters).
The sprite loader at `backend/src/sprites/library.ts` checks the filesystem first
(`backend/sprites/library/<theme>/<role>.png`) and falls back to programmatic SVG only
when a file is missing. Drop in real Kenney CC0 assets to upgrade.

The sandbox where the code is generated cannot reach `kenney.nl`. Run one of these scripts
locally where the network isn't restricted.

## What the script does

1. Downloads 4 Kenney CC0 packs into `$TEMP/edumind-kenney/`:
   - `racing-pack` → car_racing_f1 / car_racing_street / motorbike / kart
   - `sports-pack` → football / basketball / hockey / archery
   - `tower-defense-kit` → castle / rocket / skyscraper / treehouse
   - `platformer-pack-redux` → fantasy / sci_fi / detective / anime
2. Unzips each pack.
3. Copies specific PNGs into `backend/sprites/library/<theme>/<role>.png` per the
   `kenney_mapping.json` next to the script.
4. Prints `X copied, Y missing` and any roles that fell back to placeholders.

## Prerequisites

- **Windows**: PowerShell 5.1+ (already installed on Windows 10/11). Nothing else.
- **mac / linux**: `curl`, `unzip`, `jq` (install via `brew`, `apt`, or `dnf`).

## How to run

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/fetch_kenney.ps1
```

Optional flags:

```powershell
# keep the temp dir after copy (useful for debugging missing-role mappings):
powershell -ExecutionPolicy Bypass -File scripts/fetch_kenney.ps1 -KeepTemp

# custom temp dir:
powershell -ExecutionPolicy Bypass -File scripts/fetch_kenney.ps1 -TempDir C:\tmp\kenney
```

### mac / linux

```bash
bash scripts/fetch_kenney.sh

# keep extracted packs:
KEEP_TEMP=1 bash scripts/fetch_kenney.sh
```

## What if a download 404s?

Kenney's CDN URLs change with every pack version. The defaults in the script are
best-effort and may stale. If a download fails:

1. The script prints **which pack failed** and **which Kenney page to visit**:
   ```
   ⚠ Kenney's CDN URLs change between pack versions.
     1. Open https://kenney.nl/assets/<slug> in a browser.
     2. Click 'Download' (the CC0 free zip).
     3. Save the zip as $TEMP/edumind-kenney/<slug>.zip
     4. Re-run this script.
   ```
2. Drop the zip into the temp directory at the path the script told you.
3. Re-run the script. It detects the existing zip and skips re-downloading.

## What if a role goes missing?

The script's final output says e.g.:

```
Missing (loader falls back to programmatic SVG): 6
Missing roles:
  backend/sprites/library/fantasy/hero.png
    tried: PNG/Players/Player Blue/playerBlue_stand.png, Tiles/player_blue_stand.png
```

That means the source filenames in `kenney_mapping.json` don't match the version of the
pack you downloaded. Two fixes:

- **Easy**: open the extracted pack folder (`$TEMP/edumind-kenney/<slug>/`), find a
  similar PNG, add a new candidate path to that mapping entry's `from` array (the script
  tries them in order, first found wins).
- **Bulk**: regenerate the mapping for your pack version by scanning the extracted
  filenames and updating the JSON. The `_packs` block at the top of `kenney_mapping.json`
  documents the canonical Kenney slugs.

The programmatic SVG fallbacks in `backend/src/sprites/placeholders.ts` are themed
silhouettes, so a missing role degrades gracefully — the game is still playable, just
without the polish.

## How to verify the loader picks up the new files

1. Generate any lane_racer game (`POST /api/games/compose-stream` with a racing prompt).
2. Look at the response HTML. Search for `window.EduSprites = {`.
3. The `library` keys (`player`, `road`, `horizon`, etc.) should now be `data:image/png;base64,iVBOR…` (real PNGs, longer base64 payloads).
4. Before the script ran, those values were short `data:image/svg+xml;base64,…` strings — the programmatic SVG fallbacks.

## When to re-run

Re-run whenever:

- A Kenney pack releases a new version and you want the updated art.
- You add a new theme to `backend/sprites/manifest.json` and want it mapped.
- The mapping JSON changes (someone edited it on a PR).

The script is idempotent. Cached zips short-circuit. Missing files get re-copied.

## License

All assets fetched are **CC0** ([Kenney's license page](https://kenney.nl/donations)).
Free to use commercially, no attribution required (but they accept donations).
