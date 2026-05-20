# EduMind AI Game Studio

> A student types what they want to learn. **1–9 minutes** later they're playing a custom
> Phaser 4 mini-game on their phone that adapts to their performance and gives them a
> structured learning summary at the end.
>
> Latency varies with cache state (cold-start spec calls take ~50–90 s; hot-cache repeats
> are ~15–30 s) and whether AI image generation is enabled (+15–25 s and ~2¢). See
> [PERF.md](PERF.md) for measured per-stage breakdowns.

Built for grades 7–12. English and Arabic, full RTL. The LLM never invents game mechanics —
six pedagogical templates and four richer archetypes do, and validators+repair guarantee
the output is always playable.

---

## What's in the box

| Surface | Stack |
|---|---|
| **Backend** | Node 24 LTS, Fastify 5, TypeScript 5.7 strict, Prisma 6 + Postgres 16, Zod 4, Playwright chromium, pino |
| **Generation** | Claude Sonnet 4.6 (specs + code), Claude Haiku 4.5 (normalizer, repair, feedback) with 1-hour prompt caching |
| **Moderation** | OpenAI omni-moderation-latest |
| **Image gen (optional)** | Flux Schnell on fal.ai or Replicate |
| **Game engine** | Phaser 4.1.0 "Salusa" — `setTint`+`setTintMode` instead of `setTintFill`, Filter system replaces render pipelines |
| **Game runtime lib** | `EduCore.js` — i18n, RTL, HUDs, audio cues, the AdaptiveEngine |
| **Mobile app** | Flutter 3.19+, Dart 3.3+, `webview_flutter` (native), `IFrameElement` (web), `flutter_animate`, `google_fonts` |
| **Database** | Neon serverless Postgres (or any Postgres 16) |

---

## How it works

```
                                          ┌───────────────┐
   raw student prompt  ──────────────────►│ Normalizer    │
   ("idk i like racing and plants")        │  Haiku 4.5    │
                                          └───────┬───────┘
                                                  │ structured request
                                                  │ (subject, topic, archetype, theme, lang)
   if confidence < 0.6 ◄─── clarify ◄─────────────┤
                                                  ▼
                                          ┌───────────────┐
                                          │  Moderation   │ ◄── OpenAI omni-mod
                                          └───────┬───────┘
                                                  ▼
                                          ┌───────────────┐
                                          │  Spec gen     │ ◄── Sonnet 4.6 (1h cached)
                                          │  → GameSpec   │
                                          └───────┬───────┘
                                                  ▼
                            ┌──── parallel ──────────────┐
                            ▼                            ▼
                ┌───────────────────┐         ┌─────────────────┐
                │ Sprite compose    │         │ Code gen        │
                │ (library + Flux)  │         │ (Sonnet 4.6,    │
                │                   │         │  1h cached)     │
                └────────┬──────────┘         └────────┬────────┘
                         └──────────┬───────────────── ┘
                                    ▼
                            ┌──────────────┐
                            │ 16 validators│
                            └──────┬───────┘
                                   │ failures
                                   ▼
                            ┌──────────────┐
                            │ Repair (≤2)  │ ◄── deterministic regex patches
                            │              │     OR Haiku 4.5
                            └──────┬───────┘
                                   ▼
                            ┌──────────────┐
                            │ Playwright   │ ◄── chromium mobile emulation
                            │ playability  │
                            └──────┬───────┘
                                   ▼
                            ┌──────────────┐
                            │ Moderation²  │ ◄── post-call check on rendered text
                            └──────┬───────┘
                                   ▼
                            ┌──────────────┐
                            │ Persist +    │
                            │ return HTML  │
                            └──────────────┘
```

Every stage emits a **Server-Sent Events progress event** with a running cost in micro-USD,
so the Flutter dashboard can render a live progress bar and cost ticker while the pipeline runs.

---

## Repository layout

```
backend/
  client/EduCore.js            shared runtime — i18n, RTL, HUDs, AdaptiveEngine, sprite preload
  templates/                   reference game templates the LLM learns from
    match_pairs.html           ┐
    sort_categorize.html       │
    sequence.html              ├── original 6 pedagogical mechanics
    target_practice.html       │
    build_combine.html         │
    quiz_quest.html            ┘
    lane_racer.html            ┐
    goal_shootout.html         ├── 4 richer presentation archetypes
    tower_builder.html         │
    quest_path.html            ┘
  sprites/
    manifest.json              role → file map per theme (16 themes × ~7 roles)
    library/                   drop Kenney CC0 PNGs here; falls back to programmatic SVG
  prisma/
    schema.prisma              Postgres tables
    migrations/                authoritative DB history
  src/
    server.ts                  Fastify entry
    env.ts logger.ts db.ts pricing.ts
    schemas/                   Zod schemas (GameSpec, Summary, Normalizer, Archetypes)
    prompts/                   5 system prompts (spec, code, refine, feedback, normalizer)
    providers/                 Anthropic + OpenAI behind GenerationProvider / ModerationProvider
    pipeline/                  generate orchestrator, scaffold, 16 validators, repair, Playwright
    sprites/                   library loader, AI image provider, compose
    routes/                    /api/games/* + /health (incl. SSE /compose-stream)
    data/                      repair_protocol.json (15 seed entries)
  test/                        node:test for validators, repair, adaptive engine

flutter_module/
  lib/main.dart                standalone app entry
  lib/features/game_studio/
    api/client.dart            HTTP + SSE client
    db/game_database.dart      in-memory library (Drift on native)
    models/                    GameSummary, SummaryPayload, ConceptMastery
    theme.dart                 dark-navy + coral, Plus Jakarta Sans / Tajawal
    screens/
      dashboard_screen.dart    home: greeting + hero CTA + carousel + suggestions
      composer_screen.dart     3-step wizard: prompt → preferences → live progress
      game_player_screen.dart  WebView (native) / IFrame (web)
      summary_screen.dart      radial mastery rings + concept breakdown
      library_screen.dart      grid + filter chips
      profile_screen.dart      streak + mastery map
    widgets/
      glass_card.dart          glassmorphism + animated gradient mesh
      edu_bottom_nav.dart      custom-drawn icons, spring-scale on tap
      refine_modal.dart        bottom-sheet refinement
    game_studio.dart           public re-exports
```

---

## Quick start

### 1. Provision a Postgres

[Neon](https://neon.tech) is the path of least resistance — free serverless Postgres, no
Docker needed. Create a project, grab the `postgresql://...` connection string.

If you prefer local: `docker compose up -d postgres` uses the included
[docker-compose.yml](docker-compose.yml) to start a Postgres 16 container.

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — paste your Anthropic key, OpenAI key, and DATABASE_URL.
# If using Neon, use the pooler URL with ?pgbouncer=true and set DIRECT_URL too — see .env.example.

npm install --legacy-peer-deps
npx prisma generate
npx prisma migrate deploy
npx playwright install chromium

# Run
node --env-file=.env --import tsx src/server.ts
# server is now on http://localhost:8080
```

Required env (full list in [backend/.env.example](backend/.env.example)):

```
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...        # only when DATABASE_URL points at a pooler
EDUMIND_GENERATION_API_KEY=sk-ant-...
EDUMIND_MODERATION_API_KEY=sk-proj-...

# Optional — turn on AI-generated topic icons + backgrounds
IMAGE_PROVIDER=flux_schnell        # or replicate, or disabled (default)
IMAGE_PROVIDER_API_KEY=...
```

### 3. Flutter dashboard (web demo)

```bash
cd flutter_module
flutter pub get
flutter run -d chrome --web-port 5173 --dart-define=BACKEND_URL=http://localhost:8080
```

For Android: `flutter run -d <device>` — uses native `webview_flutter` so the JS bridge
between game and host runs natively (per-level + summary writes back to the cloud library).

### 4. Try it

Open `http://localhost:5173`. Tap the hero card, type something messy
("idk i like racing and plants" works), pick difficulty / session length / grade, hit
**Generate game** and watch the progress bar + cost ticker climb to ~$0.07 (~8 minutes
without image generation, ~9 minutes with). Then play it.

---

## API surface

All routes are mounted at `/api/games`. Auth via `x-student-id` header (any string).
Rate limit: 10 generations per student per day.

| Route | Notes |
|---|---|
| `POST /compose-stream` | **SSE.** Body: `{ rawPrompt, language, preferences? }`. Streams stage events + cost, ends with `done` or `error` or `clarify`. |
| `POST /compose` | Same as above but blocking; returns `{ gameId, html }` or `{ needsClarification, clarifyingQuestion }`. |
| `POST /generate` | Legacy. Skip normalizer; pass `{ subject, topic, style, theme?, extra?, language }` directly. |
| `POST /:id/refine` | Haiku-only spec edit on an existing game. |
| `POST /:id/level` | Per-level performance write-back from the JS bridge. |
| `POST /:id/complete` | Session-end summary write-back. Fires async Haiku enrichment. |
| `GET /:id/summary` | Polled by Flutter for enrichment completion. |
| `GET /library` | Per-student game list. |
| `GET /health` | `{ status, db, ts }` |

Full bridge contract for generated games:

```js
window.EduMindAPI.reportScore(value)                          // per correct answer
window.EduMindAPI.reportLevel(level, score, accuracy, ms)     // per level end
window.EduMindAPI.reportSummary(summaryPayload)               // session end (always)
window.EduMindAPI.reportComplete(score, won, time)            // session end (always, after summary)
window.EduMindAPI.reportEvent(name, data)                     // custom analytics
```

---

## The four archetypes

Each archetype maps onto exactly one pedagogical template; the underlying mechanic +
adaptive engine + scoring formula is identical to its template, the archetype is purely
presentation.

| Archetype | Mechanic | Themes |
|---|---|---|
| `lane_racer` | target_practice | car_racing_f1, car_racing_street, motorbike, kart |
| `goal_shootout` | target_practice | football, basketball, hockey, archery |
| `tower_builder` | build_combine | castle, rocket, skyscraper, treehouse |
| `quest_path` | quiz_quest | fantasy, sci_fi, detective, anime |

Lane racer specifics:

- Top prompt band shows the question text statically — no scrolling text to read
- One question gate appears at a time, three answer panels in three lanes
- Scroll speeds: 110 / 140 / 170 / 200 / 230 px/sec across levels 1→5
- Correct = points + 5% speed boost (cap 1.25× base); wrong = heart lost + 10% slowdown
- Single-finger input: tap left half → swap one lane left, right half → swap one lane right

---

## The 16 validators

Every generated game is checked in parallel against:

1. `no_browser_storage` — bans `localStorage` / `sessionStorage` / `indexedDB` / `document.cookie`
2. `no_external_resources` — only the Phaser CDN tag + EduCore include are allowed pre-scaffold
3. `bridge_calls_present` — `reportLevel`, `reportSummary`, `reportComplete` all wired
4. `three_scenes_only` — Menu + Game + End, no more
5. `uses_educore` — `AdaptiveEngine.create` + `makeScoreHud` must appear
6. `five_levels_in_spec` — exactly 5
7. `content_length_total` — ≥ 3 per level, ≥ 25 total
8. `concepts_tagged` — every item has ≥ 1 concept, all concept IDs declared
9. `touch_target_size` — every shape ≥ 44 px
10. `no_keyboard_input` — touch only
11. `phaser4_api_check` — rejects `setTintFill`, `setPipeline`, `renderer.pipelines`
12. `phaser_scale_config` — `Phaser.Scale.FIT` + `CENTER_BOTH`
13. `font_size_minimum` — ≥ 24 px EN / ≥ 28 px AR
14. `language_consistency` — `EduCore.setLanguage(x)` matches `spec.language`
15. `rtl_support_if_arabic` — every raw `add.text` carries `rtl:true`
16. `sprite_assets_referenced_exist` — every `EduSprites.library.X` / `EduSprites.generated[Y]` resolves

Each emits a signature like `phaser3_api:setTintFill` or `bridge_missing:reportSummary`,
which is the lookup key for the **living repair protocol**
([backend/src/data/repair_protocol.json](backend/src/data/repair_protocol.json)) — 15 seed
entries with either a deterministic `auto_patch` (regex_replace / inject_before / inject_after)
or a Haiku-driven `fix_template`. Unknown signatures discovered at runtime are appended with
`verified: false` for later human review.

Max 2 repair attempts per generation. If still failing, the call errors out.

---

## Adaptive engine contract

All in [backend/client/EduCore.js](backend/client/EduCore.js). The same code is exercised
by `test/adaptive.test.ts` via `node:vm`.

```
levelScore = (correct / attempts) * 0.7
           + (1 - timeUsed / timeLimit) * 0.2
           + (1 - hintsUsed / maxHints) * 0.1

≥ 0.85 → next level + 2
0.65–0.84 → next level + 1
0.40–0.64 → same level, bonus heart, fresh content
< 0.40 → next level − 1

mastery     = (level 5 ≥ 0.75)  OR  (three consecutive ≥ 0.80)
frustration = three consecutive < 0.40 → "Take a break" screen
hard cap    = 7 levels played per session

concept mastery = ≥ 3 attempts AND ≥ 0.75 accuracy
```

Generated games call `engine.completeLevel({ correct, attempts, timeUsedMs, timeLimitMs,
hintsUsed, maxHints, attemptedItems, correctItems })` at the end of each level and trust
the returned `{ score, accuracy, nextLevel, durationMs, stopReason, bonusHeart }`.

---

## Cost & caching

Per generation (without image gen):

| Stage | Tokens (typical) | Cost |
|---|---|---|
| Normalize (Haiku) | ~800 in, ~110 out | ~0.0015 USD |
| Spec (Sonnet, 1h-cached system) | ~200 in, ~5000 out, ~1200 cache-read | ~0.075 USD |
| Code (Sonnet, 1h-cached system + template) | ~3000 in, ~7500 out, ~6700 cache-read | ~0.12 USD |
| Repair (only when validators fail; Haiku) | varies | ~0.005 / attempt |
| **Total** | | **~0.07–0.20 USD** |

With AI image generation enabled: + ~$0.02 (1 background + up to 6 concept icons via Flux
Schnell on fal.ai). Hard-capped at $0.15/game in `backend/src/sprites/generated.ts`.

`EDUMIND_GENERATION_CACHE_TTL=1h` is critical. The default 5-minute cache makes most reads
miss in production traffic, multiplying cost ~10×. The logger emits `cache.below_threshold`
warnings when the read ratio drops under 70%.

---

## Bilingual / RTL

Pass `language: 'ar'` (or just type the prompt in Arabic — auto-detected, free text wins).
Every layer respects RTL:

- `<html dir="rtl">` set by scaffold
- All HUDs swap sides automatically (`EduCore.isRtl()`)
- `EduCore.addText(...)` injects `rtl: true` on every text object
- Minimum font 28 px for Arabic (24 px for English)
- Flutter app wraps everything in `Directionality(TextDirection.rtl, ...)`
- Display font swaps to Tajawal

Validator `rtl_support_if_arabic` rejects any raw `scene.add.text(...)` that doesn't carry
`rtl: true` when the spec is Arabic.

---

## Testing

```bash
cd backend
npm test                   # 16 tests
```

Coverage:

- **validators.test.ts** — 6 tests: valid spec passes all 16, localStorage flagged, missing
  reportSummary flagged, setTintFill flagged, too-few items flagged, Arabic-without-RTL flagged.
- **repair.test.ts** — 4 tests: 12 seed entries present, regex auto-patches transform HTML,
  unknown signatures return null.
- **adaptive.test.ts** — 6 tests: loads `EduCore.js` into a `node:vm` sandbox and exercises
  the engine across score brackets, mastery, frustration, hard cap, concept threshold.

```bash
cd backend
npx tsc --noEmit           # strict TS
```

```bash
cd flutter_module
dart analyze lib/          # Dart analyzer
```

---

## Adding real sprite art

The placeholder SVG generator at [backend/src/sprites/placeholders.ts](backend/src/sprites/placeholders.ts)
emits themed silhouettes (a recognizable car for racing themes, a footballer for football
themes, etc.) when no real PNG is on disk. To upgrade to real art:

1. Download [Kenney's CC0 packs](https://kenney.nl/assets):
   - Racing Pack
   - Sports Pack
   - Tower Defense (for tower_builder)
   - RPG / Platformer (for quest_path)
2. Drop the PNGs into `backend/sprites/library/<theme>/<role>.png` following the names
   in [backend/sprites/manifest.json](backend/sprites/manifest.json).
3. Restart the backend — the loader prefers filesystem files over placeholders automatically.

---

## See also

- [ARCHITECTURE.md](ARCHITECTURE.md) — deep technical walk-through
- [WHATS_NEW.md](WHATS_NEW.md) — running changelog of major additions
- [docs/api.md](docs/api.md) — full HTTP API reference with example payloads
- [docs/contributing.md](docs/contributing.md) — dev setup, coding style, PR checklist

---

## License

MIT — see [LICENSE](LICENSE).

Built with Claude Sonnet 4.6 + Haiku 4.5. Phaser 4 © Photon Storm.
Game art placeholders are programmatic SVG; production art slot for Kenney.nl CC0 packs.
