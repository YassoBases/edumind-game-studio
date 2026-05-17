# Architecture

A deep look at how EduMind Game Studio turns a sloppy student prompt into a playable,
adaptive, bilingual Phaser 4 game in under a minute. Read this if you're modifying
the pipeline, adding archetypes, tuning the engine, or debugging a generation failure.

---

## 1. Layering principle

Three layers, top to bottom:

```
┌─────────────────────────────────────────────────────┐
│ Presentation         Archetype templates (4)        │  lane_racer, goal_shootout, ...
│ (look + feel)                                       │
├─────────────────────────────────────────────────────┤
│ Pedagogy             Pedagogical templates (6)      │  match_pairs, build_combine, ...
│ (mechanic)                                          │  ← five-level engine, scoring
│                                                     │     formula, mastery, frustration
├─────────────────────────────────────────────────────┤
│ Runtime              EduCore.js                     │  i18n, RTL, HUDs, audio,
│ (engine)                                            │  AdaptiveEngine, sprite preload
└─────────────────────────────────────────────────────┘
```

Each archetype maps **1:1** onto exactly one pedagogical template. The mechanic underneath
is unchanged; the archetype is presentation only.

| Archetype → Template |
|---|
| `lane_racer` → `target_practice` |
| `goal_shootout` → `target_practice` |
| `tower_builder` → `build_combine` |
| `quest_path` → `quiz_quest` |

Why this matters: the **AdaptiveEngine** scoring formula, transition thresholds, mastery
condition, frustration safeguard, and the 5-level structure are all enforced at the bottom
layer. New archetypes can only change visuals, not the learning model.

---

## 2. The pipeline

End-to-end orchestration lives in
[backend/src/pipeline/generate.ts](backend/src/pipeline/generate.ts). Every stage emits an
SSE event with a running cost so the dashboard can render a live progress bar.

### Stages

| # | Stage | What it does | Latency | Cost |
|---|---|---|---|---|
| 0 | `normalize` | Haiku 4.5 turns raw text into `{ subject, topic, archetype, theme, language, confidence, safetyFlags, clarifyingQuestion? }`. Zod-validated. If `confidence < 0.6` we return a clarifying question to the UI instead of running the rest. | ~1 s | ~0.1¢ |
| 1 | `moderation_pre` | OpenAI omni-moderation-latest on the free-text fields. | ~0.5 s | free |
| 2 | `spec` | Sonnet 4.6 with `SPEC_SYSTEM_PROMPT` (1h cached) generates the full Game Spec JSON. Zod-validated with one retry on schema failure; soft-truncates `explanationOnWrong` to 120 chars and `prompt` to 240 chars. | 60–90 s | ~7.5¢ |
| 3a | `sprites` | Library lookup (filesystem first, programmatic SVG fallback) + optional Flux Schnell calls for 1 background + 6 concept icons. Runs in parallel with code generation. | 50 ms (no AI) – 20 s (AI) | 0 – ~2¢ |
| 3b | `code` | Sonnet 4.6 with `CODE_SYSTEM_PROMPT` + the archetype HTML template (both 1h cached) returns the inner-script JS. | 90–150 s | ~12¢ |
| 4 | `validators` | All 16 validators run in parallel against the scaffold-wrapped HTML. | <10 ms | free |
| 5 | `repair` | If any failures: deterministic regex auto-patches first, then Haiku 4.5 with the per-signature `fix_template`. Max 2 attempts. | varies | ~0.5¢ / attempt |
| 6 | `playability` | Playwright chromium-mobile loads the HTML, taps once at (180, 320), checks for `pageerror` / `console.error` after 5 s. Dev: every generation. Prod: 20% sample. | ~5 s | free |
| 7 | `moderation_post` | OpenAI omni-moderation on a sample of `prompt` + `explanationOnWrong` strings from the spec. | ~0.5 s | free |
| 8 | `persist` | Game row + token + image-cost counters written to Postgres. | <50 ms | free |
| 9 | `done` | Final SSE event carries `gameId`, `orientation`, `language`, `html`, `totalCostMicroUsd`. | — | — |

### The emitter pattern

`runGenerationPipeline()` accepts an optional `onStage: (StageEvent) => void` callback
threaded through every stage. The blocking `POST /compose` route discards it; the SSE
`POST /compose-stream` route writes each event into the response stream.

---

## 3. EduCore.js — the runtime

[backend/client/EduCore.js](backend/client/EduCore.js). About 600 lines, vanilla JS, no
framework. Inlined into every generated HTML.

### Public API

```js
window.EduCore.setLanguage('en' | 'ar')
window.EduCore.t(key, params?)
window.EduCore.isRtl()

// HUD primitives (RTL-aware, side-mirrored automatically)
makeScoreHud(scene, x, y)         // → { set(n), add(n), value() }
makeTimerHud(scene, x, y, sec, onTimeout)
makeHeartsHud(scene, x, y, count)
makeLevelHud(scene, x, y, current, max)
makeProgressBar(scene, x, y, w, h)

// Toasts
showCorrect(scene, x, y, scoreGained)
showWrong(scene, x, y, explanation)
showHint(scene, x, y, hintText)
showLevelComplete(scene, { score, accuracy, delta }, onDismiss)

// Synthesized audio (Web Audio, gated behind first tap)
cues.correct() | wrong() | levelUp() | win() | lose() | tick()

// Sprite preload helpers
preloadSprites(scene, ['player','road','horizon',...])
preloadGeneratedConcepts(scene, ['overall_equation','light_reactions',...])
hasSprite(role) | hasGeneratedSprite(conceptId)

// Scene factories used by all archetypes
buildMenuScene(spec) → class
buildEndScene(getSummary, onReplay, onExit) → class

// THE engine
AdaptiveEngine.create(spec) → {
  currentLevel,
  completeLevel({ correct, attempts, timeUsedMs, timeLimitMs, hintsUsed, maxHints,
                  attemptedItems, correctItems })
    → { score, accuracy, nextLevel, durationMs, stopReason, bonusHeart },
  buildSummary() → Summary,
  stopReason(),
  levelHistory()
}
```

### Adaptive engine internals

```text
levelScore = correctRatio*0.7 + timeBonus*0.2 + hintBonus*0.1
  where correctRatio = correct / attempts
        timeBonus    = 1 - min(1, timeUsedMs / timeLimitMs)
        hintBonus    = 1 - hintsUsed / maxHints

delta(score) =  +2  if score ≥ 0.85
                +1  if score ≥ 0.65
                 0  if score ≥ 0.40  (same level, bonus heart, fresh content)
                -1  otherwise

mastery     = lastLevel.adapted == 5 AND lastLevel.score ≥ 0.75
              OR  last 3 levels all ≥ 0.80
frustration = last 3 levels all < 0.40 → stopReason='frustration'
hard cap    = 7 levels played → stopReason='cap'

conceptMastery[conceptId] = attempts ≥ 3 AND correct/attempts ≥ 0.75
```

Tested directly in Node via `vm.createContext` — see
[backend/test/adaptive.test.ts](backend/test/adaptive.test.ts).

---

## 4. Game Spec schema

Zod 4 schemas at [backend/src/schemas/gameSpec.ts](backend/src/schemas/gameSpec.ts). The
two cross-cutting refinements enforce invariants the type system can't:

```ts
.refine((s) => s.levels.reduce((sum, l) => sum + l.contentItems.length, 0) >= 25)
.refine((s) => every contentItem.concepts[X] exists in s.concepts[].id)
.refine((s) => themeId belongs to archetype's theme family)
```

A valid spec always has:

- exactly **5 levels** (Zod tuple of 5)
- each level has ≥ 3 content items
- **≥ 25 content items total**
- every content item is concept-tagged with at least one ID from `spec.concepts`
- difficulty monotonically rising across levels (model-enforced, not schema-enforced)
- `templateId` ∈ 6 fixed values
- `language` ∈ `en` | `ar`
- `audioCues` enum-restricted
- palette is a tuple of exactly 4 colors

Soft-clipping in the provider — `explanationOnWrong > 120 chars` and `prompt > 240 chars`
get truncated with an ellipsis before validation. The cap stays meaningful but the model
isn't bounced for a 30-char overshoot.

---

## 5. System prompts

Five system prompts, all cached at 1h.

| Prompt | Model | Purpose | Cached |
|---|---|---|---|
| `NORMALIZER_SYSTEM_PROMPT` | Haiku 4.5 | Raw text → structured request | 1h |
| `SPEC_SYSTEM_PROMPT` | Sonnet 4.6 | Structured request → GameSpec JSON | 1h |
| `CODE_SYSTEM_PROMPT` | Sonnet 4.6 | GameSpec + template → inner-script JS | 1h |
| `REFINE_SYSTEM_PROMPT` | Haiku 4.5 | Repair instructions → fixed HTML | 1h |
| `FEEDBACK_SYSTEM_PROMPT` | Haiku 4.5 | Summary → enriched recommendations | 1h |

Every Anthropic call sends both the system prompt **and** the relevant template HTML as
separate `cache_control: { type: 'ephemeral', ttl: '1h' }` breakpoints (max 4 per call).
Spec generation also injects the allowed `themeId` enum values inline into the user prompt
to prevent the model from inventing new theme strings.

---

## 6. Sprite system

Two layers, both inlined into the generated HTML as base64 data URIs so games are fully
self-contained and offline-playable.

### LibraryProvider — pre-built per-theme assets

[backend/src/sprites/library.ts](backend/src/sprites/library.ts) reads
[backend/sprites/manifest.json](backend/sprites/manifest.json) (16 themes × ~7 roles each),
checks the filesystem under `backend/sprites/library/<theme>/<role>.png`, and falls back
to a programmatic SVG silhouette via
[backend/src/sprites/placeholders.ts](backend/src/sprites/placeholders.ts) when a file is
missing. Drop in Kenney CC0 PNGs to upgrade — no code change needed.

### GeneratedProvider — Flux Schnell topic icons + backgrounds

[backend/src/sprites/generated.ts](backend/src/sprites/generated.ts). Per game:

- 1 **background** image (portrait 720×1280, full-screen backdrop matching theme+topic)
- up to 6 **concept icons** (square 512×512, flat-vector silhouettes keyed by `conceptId`)

Caching: SHA-256 of `archetype|theme|conceptId|topic|subject` is the cache key. Hits
bypass the provider entirely. Cache table mirrored in Postgres
(`SpriteCache`) with hit counter for analytics.

Budget enforcement: hard cap 15¢ per game in image gen. Defaults to disabled
(`IMAGE_PROVIDER=disabled`); flip on with `flux_schnell` or `replicate`. Failure mode:
any provider error → game falls back to library + text labels. Games are still fully
playable without image generation.

### Manifest contract

```js
window.EduSprites = {
  library:   { player: 'data:image/svg+xml;base64,...', road: '...', ... },
  generated: { theme_background: 'data:image/png;base64,...',
               overall_equation: 'data:image/png;base64,...',
               light_reactions:  '...' }
}
```

Templates consume these via `EduCore.preloadSprites(scene, ['player','road',...])` and
`scene.textures.exists('lib:player')` / `scene.textures.exists('gen:overall_equation')`.

Validator `sprite_assets_referenced_exist` rejects any code referencing a sprite key not
present in the assembled manifest.

---

## 7. Repair protocol

[backend/src/data/repair_protocol.json](backend/src/data/repair_protocol.json). Each
entry:

```json
{
  "signature": "phaser3_api:setTintFill (use setTint + setTintMode in Phaser 4)",
  "occurrences": 1,
  "last_seen": "2026-05-15T...",
  "root_cause": "setTintFill was removed in Phaser 4. ...",
  "fix_template": "Replace .setTintFill(0xRRGGBB) with .setTint(0xRRGGBB).setTintMode(1).",
  "auto_patch": {
    "type": "regex_replace",
    "pattern": "\\.setTintFill\\(([^)]+)\\)",
    "replacement": ".setTint($1).setTintMode(1)"
  },
  "verified": true
}
```

Three `auto_patch` types: `regex_replace`, `inject_before`, `inject_after`. When an
`auto_patch` exists, it's applied **first** and then validators re-run; only failures
without auto-patches go to Haiku 4.5 with the `fix_template` injected into the user prompt.

Unknown signatures observed at runtime are appended with `verified: false` and the failure
detail as `root_cause` — they show up in the JSON file for human review.

The JSON file is the source of truth. The Postgres `RepairProtocolEntry` table mirrors it
for analytics: "which repair signatures fired most often this week?"

---

## 8. Scaffold wrapper

[backend/src/pipeline/scaffold.ts](backend/src/pipeline/scaffold.ts). The LLM only writes
the inner-script JS. The backend wraps it with:

- `<!DOCTYPE html>` + `<html lang dir>` derived from `spec.language`
- viewport meta with `user-scalable=no`
- `@font-face` Noto Sans Arabic (woff2 base64, only when present at
  `backend/src/data/arabic_font_base64.txt`)
- Phaser 4.1.0 bundle (production: inlined from `backend/src/data/phaser_4_1_0.min.js`;
  dev: CDN tag)
- EduCore.js inlined
- `window.EduSprites = { library, generated }` JSON literal
- `EduMindAPI` bridge stub posting to `window.EduMind?.postMessage`
- Tap-once `AudioContext.resume()` to satisfy WebView autoplay policy
- finally the LLM's inner-script

This is the **only** path that produces HTML. The LLM cannot produce a full document.
That keeps the surface of failure tightly bounded.

---

## 9. Database

Postgres 16 via Prisma 6. Tables in [backend/prisma/schema.prisma](backend/prisma/schema.prisma):

| Table | Purpose |
|---|---|
| `Student` | id, externalId, language |
| `Game` | spec (JSON), html (TEXT), tokens, image cost, archetype, themeId |
| `LevelRecord` | per-level score / accuracy / duration |
| `Summary` | session-end payload + async-enriched recommendations |
| `ConceptMastery` | PK (studentId, conceptId), attempts, correct, lastSeen |
| `SpriteCache` | sha256 → base64Data, prompt, hits |
| `RepairProtocolEntry` | mirror of the JSON file for analytics |
| `PromptVersion` | versioned prompt history (placeholder) |

Connection lifecycle: with Neon's serverless tier, idle compute auto-suspends during
~2 min LLM calls. We use **the pooler URL with `?pgbouncer=true`** for `DATABASE_URL`
and a direct URL for `DIRECT_URL` (migrations only). The pooler transparently buffers
reconnects.

---

## 10. Flutter app

Single feature module at `flutter_module/lib/features/game_studio/`. No changes to any
host code.

### Design language

- **Dark navy base** `#0B1026`, electric **coral** `#FF4D6D` primary, electric **teal**
  `#5EEAD4` secondary, **violet** `#A78BFA` accents
- **Plus Jakarta Sans** display + body (English), **Tajawal** display (Arabic)
- **Glassmorphism** via `BackdropFilter` with gradient-stroke borders + inner shadows
- **Animated gradient mesh** (three radial blobs orbiting on a sine/cosine path) behind every screen
- **Custom-drawn nav icons** (no Material defaults) that spring-scale on selection
- `flutter_animate` for declarative staggers, fades, slides, scales

### Screens

| Screen | What it does |
|---|---|
| `DashboardScreen` | Greeting that adapts to time of day, hero CTA card (gradient bg), Continue-Playing carousel from `/library`, three Suggested cards that prefill the composer, bottom nav |
| `ComposerScreen` | 3-step wizard: prompt (rotating placeholder examples) → preferences (difficulty / session length / grade chips / optional focus) → live generation with progress bar + cost ticker |
| `GamePlayerScreen` | `WebViewController` on native, `IFrameElement` via `HtmlElementView` on web. Orientation-locked. Immersive UI. JS channel `EduMind` routes bridge events |
| `SummaryScreen` | Animated radial mastery rings (CustomPainter), glass concept rows, chip-style strengths/growth, recommended-topic tiles. Polls `/summary` for async Haiku enrichment |
| `LibraryScreen` | Filter chips, grid layout with theme thumbnails, offline-first (`GameDatabase` stub) |
| `ProfileScreen` | 4-stat grid + subject→topic mastery progress map |

### SSE compose client

`GameStudioApi.composeStream({ rawPrompt, language, preferences? })` returns
`Stream<ComposeStreamEvent>` where event is one of:

```dart
sealed class ComposeStreamEvent {}
class StageProgressEvent extends ComposeStreamEvent { stage, label, status, latencyMs, costMicroUsd, detail }
class ComposeClarifyEvent extends ComposeStreamEvent { clarifyingQuestion, suggestedArchetype, ... }
class ComposeDoneEvent extends ComposeStreamEvent { game, totalCostMicroUsd, normalized }
class ComposeErrorEvent extends ComposeStreamEvent { message }
```

The composer state machine listens, updates the progress bar, and navigates to the player
on `done`.

---

## 11. Idempotency, rate-limiting, observability

- **Idempotency**: in-memory cache keyed by the `Idempotency-Key` header, 24-hour TTL.
  Same key within 24h returns the previously generated game without re-running the pipeline.
  Production swap: Redis.
- **Rate limit**: 10 generations / student / day via `@fastify/rate-limit`, keyed by
  `x-student-id` header.
- **Structured logs**: pino emits `llm.call` events with `phase`, `model`, `latencyMs`,
  `inputTokens`, `outputTokens`, `cacheReadTokens`, `cacheWriteTokens`, `cacheReadRatio`.
  Warning fires when read ratio < 0.7.

---

## 12. Streaming everywhere

The Anthropic SDK rejects non-stream requests whose `max_tokens` could exceed a 10-minute
wall clock — which our repair calls (24k tokens) trip every time. The provider
([backend/src/providers/anthropic.ts](backend/src/providers/anthropic.ts)) uses
`client.messages.stream({...}).finalMessage()` for **all** calls. Same token accounting,
same cache reporting, no time limit.

JSON extraction is hardened too: `extractJsonObject()` finds the first balanced `{...}`
in the response even when the model leaks prose preamble on retries.

---

## 13. Known sharp edges

- **Generation latency**: 4–9 min cold, 2–5 min warm. Inlining the Phaser bundle at
  `backend/src/data/phaser_4_1_0.min.js` would save ~250 KB on every response.
- **Cache read ratio**: ~88% on spec, ~61% on code. The code call's template is fully
  cached but per-spec content variance pulls the ratio down. Acceptable, monitored.
- **Image cost cap**: 15¢ / game enforced in `generated.ts`. If 6 concept icons + 1
  background trip the cap, the remainder fall back to text labels (game still playable).
- **Flutter web bridge**: `IFrameElement` doesn't surface bridge messages back to Dart
  the way `webview_flutter` does on native. Per-level + complete writes work natively;
  on web the game runs locally but cloud-side level history won't update. Tracked.
- **Bundle size**: scaffold-wrapped HTML is ~40–60 KB without image generation, can
  reach ~1.5 MB with all 7 generated sprites. Below the 2 MB response cap; if you push
  past it, `sprite_size_exceeded` repair entry kicks in.

---

## Where to start reading code

| If you want to… | Open |
|---|---|
| Understand the pipeline orchestrator | [backend/src/pipeline/generate.ts](backend/src/pipeline/generate.ts) |
| Change scoring or mastery rules | [backend/client/EduCore.js](backend/client/EduCore.js) `AdaptiveEngineCreate` |
| Add a validator | [backend/src/pipeline/validators.ts](backend/src/pipeline/validators.ts) |
| Add a repair signature | [backend/src/data/repair_protocol.json](backend/src/data/repair_protocol.json) |
| Add an archetype | drop a template at `backend/templates/<name>.html`, add to `ARCHETYPE_IDS` + `ARCHETYPE_TO_TEMPLATE` in [backend/src/schemas/archetypes.ts](backend/src/schemas/archetypes.ts) |
| Tune a system prompt | [backend/src/prompts/](backend/src/prompts/) |
| Reskin the dashboard | [flutter_module/lib/features/game_studio/theme.dart](flutter_module/lib/features/game_studio/theme.dart) |
