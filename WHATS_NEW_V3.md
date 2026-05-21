# What's New V3 — Duolingo brand + cost reduction + storage loop

The three problems v3 fixed:

1. **The Flutter app looked generic.** v2 shipped great game *templates* but the surrounding
   app was a debug harness. v3 adopts a full Duolingo brand language — palette, fonts,
   candy buttons, rounded everything, mascot, XP/streak/league surface.
2. **Generation cost was ~$0.21/game.** Five cost levers bring it down to a target
   ~$0.08/game without sacrificing quality.
3. **Saved games weren't playable from the library.** The full storage round-trip now
   works: persist → list → fetch HTML on demand → play → record best score.

Plus closed out asset gaps v2 deferred (Phaser bundle inlined from npm; Kenney fetch
script for local run).

---

## Mascot decision: a fox named "Pip"

Picked the fox over the comet/star option. Rationale:

- Differentiates from Duolingo's owl while reading as warm and curious.
- Easier to convey emotion at small sizes (eyes + ears + tail) vs. abstract trail.
- Universal cultural recognition — works for English and Arabic audiences.
- Vector-drawable from primitives without needing facial muscle layers.
- "Pip" is two consonants kids can pronounce, no localisation friction.

Pip ships in **both** runtimes from a single character spec:

- **[backend/client/Mascot.js](backend/client/Mascot.js)** — 420 lines of Phaser Graphics,
  8 expressions (idle / happy / cheering / thinking / sad / celebrating / sleeping /
  surprised), idle bob + blink loop, event reactions (`correct` / `wrong` / `combo3` /
  `levelComplete` / `streak` / `idle`).
- **[mascot_widget.dart](flutter_module/lib/features/game_studio/widgets/mascot_widget.dart)** —
  CustomPainter mirror. Same character, same expression presets, same color palette.
  `MascotController` exposes the same `react('correct')` etc. for screen-side events.

5 tests verify API surface, expression accept-all, react accept-all, null-scene safety.

---

## What got built

### Phase 0A — Phaser via npm + boot-time inline (Problem 0A)

- `"phaser": "4.1.0"` added to `backend/package.json` dependencies.
- **[backend/src/bootstrap/inline_phaser.ts](backend/src/bootstrap/inline_phaser.ts)**
  copies the bundle from `node_modules/phaser/dist/phaser.min.js` →
  `backend/src/data/phaser_4_1_0.min.js` on every server boot (no-op if already staged).
- Scaffold no longer gates on `NODE_ENV=production`; inlines whenever the file exists.
- Verified: bundle staged at **1,351,849 bytes** after first boot. Saves ~1.3 MB of CDN
  fetch + one round trip per game render.

### Phase 0B — Kenney fetch scripts (Problem 0B)

Sandbox-bound execution can't reach `kenney.nl`, so the scripts are for local run:

- **[scripts/fetch_kenney.ps1](scripts/fetch_kenney.ps1)** — Windows / PowerShell.
- **[scripts/fetch_kenney.sh](scripts/fetch_kenney.sh)** — mac / linux / WSL.
- **[scripts/kenney_mapping.json](scripts/kenney_mapping.json)** — 38 source→dest entries
  covering all 16 themes. Data-driven so when a Kenney pack's filenames change between
  versions, you edit the JSON, not the scripts.
- **[scripts/KENNEY_README.md](scripts/KENNEY_README.md)** — explainer with
  prerequisites, run instructions, 404 fallback (drop the zip manually), missing-role
  recovery, and verification steps.

Both scripts handle 404s gracefully by telling the user which Kenney page to visit and
where to drop the zip.

### Phase 2 — Brand foundation (Problem 1)

**[flutter_module/lib/features/game_studio/theme.dart](flutter_module/lib/features/game_studio/theme.dart)**
fully rewritten:

- **`EduPalette`** — `primaryGreen #58CC02`, `actionBlue #1CB0F6`, `streakYellow #FFC800`,
  `heartRed #FF4B4B`, `purple #CE82FF`, `baseDark #131F24`, plus derived `*Dark` shades
  for the shadow band under candy buttons.
- **Typography** — Nunito (EN) + Tajawal (AR) via `google_fonts`. ExtraBold for display,
  SemiBold for body. Letter spacing -0.5 on display (-0 on Arabic).
- **`EduRadius`** — `card 24`, `button 16`, `input 20`, `pill 999`, `thumbnail 18`, `sheet 28`.
- **`EduCurves`** — `spring` (overshoots, lands clean), `bounce` (big celebrations),
  `soft` (subtle hover), `candyPress` (button down/up).
- **`EduShadows.candy(shadow)`** — the 5px dark band beneath candy buttons.
- Light theme is now the default (Duolingo's actual treatment). Kept legacy v2 dark-mode
  palette aliases as constants so old widgets still compile during transition.

### Phase 3 — Candy button in both runtimes (Problem 1)

The signature Duolingo-style button. Solid top, 5px darker shadow band, presses 5px down
on tap (the shadow disappears under the surface), restores on release.

- **[flutter_module/.../widgets/candy_button.dart](flutter_module/lib/features/game_studio/widgets/candy_button.dart)** —
  6 variants (green / blue / yellow / red / purple / outline), 3 sizes (small / medium /
  large). 90ms press animation. Disabled state at 70% opacity.
- **`GameFeel.candyButton(scene, x, y, w, h, label, opts)`** in
  [GameFeel.js](backend/client/GameFeel.js) — same shadow band + press behavior in
  Phaser, returns `{ container, setLabel, setEnabled, destroy }`.

### Phase 4 — Reusable Flutter widgets

The supporting cast for the brand:

- **[xp_bar.dart](flutter_module/lib/features/game_studio/widgets/xp_bar.dart)** —
  animated progress fill with a 600ms tween, 800ms shimmer sweep on XP gain.
- **[streak_flame.dart](flutter_module/lib/features/game_studio/widgets/streak_flame.dart)** —
  hand-drawn flame (CustomPainter), idle flicker via sine wave, big flare on extend
  triggered by a `ValueNotifier<bool>` toggle. Greys out at count 0.
- **[heart_row.dart](flutter_module/lib/features/game_studio/widgets/heart_row.dart)** —
  CustomPainter heart shapes, scale-bounce on loss.
- **[progress_ring.dart](flutter_module/lib/features/game_studio/widgets/progress_ring.dart)** —
  daily-goal arc ring with center emoji + `current/goal` text. 500ms tween.
- **[lesson_node.dart](flutter_module/lib/features/game_studio/widgets/lesson_node.dart)** —
  Duolingo-style mastery-tree node. Three states: locked (grey + 🔒), available (green +
  ▶), mastered (yellow + 🏆). Same shadow-band candy treatment.

### Phase 5 — Five cost levers (Problem 3)

#### Lever A — Haiku spec routing
- `complexity: 'simple' | 'standard' | 'novel'` added to `NormalizedRequest` Zod schema.
- Normalizer prompt has an explicit rubric for the field. Most common curriculum topics
  (photosynthesis, mitosis, capitals, fractions, etc.) qualify as 'simple'.
- `SpecInput.useFastModel` flag plumbed through the provider.
- Pipeline routes 'simple' → Haiku for spec. Haiku failures **escalate to Sonnet on
  attempt 2** (not retried in a loop), so a bad classification costs at most one Haiku call.
- Target: ~70% of inputs classify simple → spec cost $0.075 → $0.015 on those.

#### Lever B — SpecCache
- New `SpecCache` Postgres table.
  **[backend/src/pipeline/spec_cache.ts](backend/src/pipeline/spec_cache.ts)** with
  `makeSpecCacheKey` (sha256 of subject+topic+language+archetype+themeFamily+difficulty+sessionLength).
- 24h TTL. Pipeline checks cache before the LLM call; hit → skip spec generation entirely.
- `/refine` bypasses the cache (students hitting refine want something different).
- Expected hit rate in classroom usage: ~30% (groups of students working on same topic).

#### Lever C — EduCore factories
Five new functions in **[EduCore.js](backend/client/EduCore.js)** that let the LLM offload
boilerplate to the runtime:
- `EduCore.buildPhaserConfig({width, height})` — spread into `new Phaser.Game`
- `EduCore.buildBridgeWiring(scene, engine)` → `{ reportLevel, reportFinish, reportScore }`
- `EduCore.makeHud(scene, opts)` → `{ score, timer, levelHud, hearts, mascot }`
- `EduCore.buildLevelLoop(scene, spec, engine, bridge, callbacks)` — owns the 5-level
  transition logic (levelStart → gameplay → levelEnd → next intro).
- `EduCore.buildGameSceneSkeleton(spec, archetype, callbacks)` — returns a `Phaser.Scene`
  class for templates to extend.

Validator **`uses_educore_factories`** requires ≥3 distinct factory references in the
generated code. Realistic drop in code-call output tokens: ~7,500 → ~4,500.

#### Lever D — Refinement patcher
**[backend/src/pipeline/refine_patcher.ts](backend/src/pipeline/refine_patcher.ts)**
classifies the refine instruction via one tiny Haiku call (~50 in / ~50 out tokens,
$0.0001) into one of 5 patterns:

1. `harder` — −15% time, −1 hint, +0.1 difficulty across all levels
2. `easier` — opposite
3. `more_questions` — clone up to 2 items per level with new IDs
4. `change_theme` — swap `themeId`, regenerate sprite manifest only, **skip both spec
   and code regeneration** (cost ~$0)
5. `other` — falls back to full pipeline

Patterns 1-3 apply the patch deterministically and call code-gen once with the patched
spec ($0.05-0.07). Pattern 4 skips LLM entirely. Pattern 5 = legacy path. Wired into
`POST /api/games/:id/refine` — the route now returns `refinePattern` so the client knows
which path ran.

#### Lever E — Tighter cache breakpoints
The code call now sends 3 independent cached breakpoints:

```ts
system: [
  { text: CODE_SYSTEM_PROMPT,     cache_control: { ttl: '1h' } },  // universal, all archetypes
  { text: ARCHETYPE_PRINCIPLES,   cache_control: { ttl: '1h' } },  // per-archetype, ~800 tokens
  { text: TEMPLATE_HTML,          cache_control: { ttl: '1h' } },  // changes on redeploy
]
```

**[backend/src/prompts/archetype_principles.ts](backend/src/prompts/archetype_principles.ts)** —
new per-archetype guidance blocks (lane racer / goal shootout / tower builder / quest
path). Each ~800 tokens, lists the required juice for that archetype. Splitting the
breakpoints aligns each cache hit with its actual change cadence. Target: code-call
cache-read ratio 61% → 85%.

**Combined target**: $0.21 → ~$0.08/game (62% reduction).

### Phase 6 — Game storage loop (Problem 4)

Backend additions to the `Game` model (additive only):
- `lastPlayedAt: DateTime?`
- `playCount: Int default 0`
- `bestScore: Int default 0`
- `deletedAt: DateTime?` (soft delete)

New endpoints:
- `GET /api/games/:id` — full payload incl. HTML, owner-scoped (403 on non-owner)
- `DELETE /api/games/:id` — soft delete via `deletedAt` timestamp
- `PATCH /api/games/:id` — player calls on session start (`lastPlayedAt` + `playCount++`)

`/library` endpoint upgraded:
- Filters out soft-deleted rows
- Sorts `lastPlayedAt DESC NULLS LAST, createdAt DESC` (recently-played first)
- Returns metadata only (no HTML payload) — `GET /:id` fetches the HTML on launch
- Supports `?limit=N&before=<timestamp>` pagination

**`bestScore` writeback** now lives in the backend's `/api/games/:id/complete` handler:
on session end, `Math.max(game.bestScore, summary.totalScore)` is persisted plus
`lastPlayedAt + playCount` get updated atomically.

### Phase 7 — XP / streak / daily goals / league (Problem 5)

Schema additions on `Student`:
- `xp Int default 0`
- `streakCount Int default 0`
- `streakLastPlayedAt DateTime?`
- `dailyGoal Int default 3`
- `leagueTier String default 'bronze'` ('bronze' | 'silver' | 'gold')

New tables: `XpEvent` (id, studentId, amount, reason, gameId?, createdAt) and
`StreakEvent` (id, studentId, action, countAfter, createdAt).

**[backend/src/routes/students.ts](backend/src/routes/students.ts)** exposes:
- `GET /api/students/me/stats` → `{ xp, streakCount, streakLastPlayedAt, dailyGoal, dailyProgress, leagueTier }`
- `POST /api/students/me/streak-check` — advances or breaks streak on dashboard load
- `GET /api/students/me/xp-events?limit=50` — recent XP awards

**`awardCompletionXp`** is called from `/complete`. Rules:
- correct answers ≈ overallAccuracy × 25 items × 10 XP each
- 50 XP × levelsPlayed (computed from totalScore / 60)
- +200 XP if `masteryAchieved`
- +25 XP × streakCount on extension, capped at 250

Streak math: a "play day" = any UTC date with ≥1 reportComplete. Extension fires when
yesterday had a play AND today's first completion lands. Gap ≥ 2 days → streak resets to 1.

League tier: bronze (<500 XP) → silver (≥500) → gold (≥2000). Recomputed on every XP award.

Three new audio cues added to **GameFeel.audio**:
- `streakExtended` — two-tone ascending woosh + sparkle
- `xpGain` — single shimmer tick (UI plays per-XP at 30ms intervals)
- `goalReached` — daily-goal fanfare

### Phase 8 — Validators + repair seeds + CODE_SYSTEM_PROMPT (Problem 1)

Three new validators registered in the pipeline:
- **`uses_mascot`** — generated code must call `window.Mascot.create(...)` at least once.
  Signature: `mascot_missing`.
- **`uses_candy_button`** — if the game has interactive buttons (`setInteractive`), at
  least one must be `GameFeel.candyButton`. Signature: `raw_buttons:no_candy`.
- **`uses_educore_factories`** — ≥3 distinct factory references. Signature:
  `educore_factories_low:<n>`.

Three new repair-protocol seeds with detailed fix templates for the new signatures.

Two **legacy** validators were updated to accept both the old direct-pattern and the new
factory-pattern as valid (cost-lever-C-friendly):
- `bridge_calls_present` now accepts `EduCore.buildBridgeWiring(...)` + `bridge.reportFinish()`
- `uses_educore` accepts `EduCore.makeHud(...)` and `EduCore.buildGameSceneSkeleton(...)`
- `phaser_scale_config` accepts `EduCore.buildPhaserConfig()` as valid scale config

`CODE_SYSTEM_PROMPT` gained a **MANDATORY PRIMITIVES** section at the top covering:
1. Pip the fox via `Mascot.create + pip.react(...)`
2. Candy buttons for every UI button — never raw `setInteractive`
3. ≥3 EduCore factory references

The taste/aesthetic direction from v2 stayed; v3 only added the new mandates.

### Tests

- **47 tests pass, zero failures**.
- 11 v3-era additions across `gamefeel.test.ts` (candy button + 3 new audio cues),
  `mascot.test.ts` (5 tests), and updated `validators.test.ts`.
- Test fixture (`VALID_INNER_SCRIPT`) updated to demonstrate the new factory + mascot +
  candy-button patterns so validators pass it.

---

## What stayed untouched (sacred)

- AdaptiveEngine scoring formula, transition thresholds, mastery, frustration, hard cap.
- The 17 v2 validators (additive only — 3 new in v3).
- The 17 v2 repair seeds (additive only — 3 new in v3).
- Bridge contract: existing event names, payload shapes, firing order.
- 5-level structure, ≥3 items/level, ≥25 total.
- The v2-rewritten archetype templates — `lane_racer.html`, `goal_shootout.html`,
  `tower_builder.html`, `quest_path.html`. These still contain v2's juice and are the
  reference patterns the LLM learns from. Adding mascot + candy button via the system
  prompt rather than retro-editing the templates (which would risk breaking the v2 juice).
- GameFeel.js core — additive only (`candyButton` + 3 new audio cues + nothing removed).
- Pipeline orchestrator stage order.

---

## Decisions made along the way

1. **Fox over comet** — easier to convey eight distinct emotions at small sizes. Same fox
   in Phaser Graphics and Flutter CustomPainter, drawn from the same primitives spec.
2. **Pip not Foxy/Sage/etc.** — two consonants, language-neutral, kid-pronounceable.
3. **Light theme as default** — v2 was dark navy; v3 is soft-white. Duolingo's actual
   default. Kept v2 dark palette aliases as constants so legacy widgets compile.
4. **`uses_educore_factories` ≥3 distinct (not ≥5)** — three is enough to demonstrate the
   pattern and force ~3,000 fewer output tokens; five would force replacement of every
   manual helper and risk fighting the v2 templates.
5. **`uses_candy_button` is conditional** — passes when the game has no buttons at all.
   Some archetypes might not need a Start/Continue button surface. Avoids false positives.
6. **Refine patcher classification is Haiku, not Sonnet** — the classifier prompt is
   tiny (~50 tokens) and the failure mode (misclassify to "other") just falls back to
   the legacy path. No point spending $0.005 on classification.
7. **Pattern 4 (change_theme) skips even the code call** — themes are pure presentation.
   Sprite manifest swap + scaffold rewrap. ~$0 + ~5 seconds.
8. **Streak XP cap at +250** — without a cap, a 30-day streak would hand out 750 XP per
   game, distorting the league progression.
9. **`streakLastPlayedAt` is UTC midnight, not real timestamp** — simpler to reason about
   "is this the same play day?" across timezones. International rollout will need
   per-student timezone but the schema field is general enough.
10. **The `awardCompletionXp` writeback is best-effort** — wrapped in a try/catch so a
    DB hiccup doesn't fail the player's `/complete` call.
11. **Phaser bundle inline gate is "file present", not "NODE_ENV=production"** — gives
    dev runs the same fast path as prod. Boot-time hook stages the file on every server
    start; if it's already there, the hook is a no-op.
12. **Kenney scripts are data-driven** — `kenney_mapping.json` decouples the script logic
    from Kenney's filename-version churn. Edit the JSON when filenames change; no script
    change needed.
13. **`refine_patcher.classifyRefine` uses an inline Anthropic client** — the provider
    abstraction doesn't expose the raw SDK, and exposing it would muddy the contract.
    The classifier is allowed to instantiate its own one-shot client.

---

## Remaining mediocrity (what didn't land)

1. **Full Flutter screen rebuild deferred.** Brand foundation + 5 reusable widgets shipped;
   the dashboard / composer / library / profile / onboarding screen *rewrites* didn't ship.
   The v2 screens still function. The brand pieces are ready for the next pass:
   `EduPalette`, `EduRadius`, `EduCurves`, `EduShadows`, `CandyButton`, `MascotWidget`,
   `XpBar`, `StreakFlame`, `HeartRow`, `ProgressRing`, `LessonNode`. A screen rebuild
   would be ~3,000 lines of UI work and was out of scope for this session.
2. **Corpus run not executed.** Estimated cost was ~$8 for 100 games after the v3
   optimizations. I built the runner (existed since v2 at
   [backend/scripts/generate_corpus.ts](backend/scripts/generate_corpus.ts)) and the
   levers are in place; running it requires a confirmation step the user gates.
3. **Cost numbers are projected, not measured.** The 5 levers are wired and the
   architecture supports the savings, but actual cost per generation will only confirm
   after running 20+ real generations against the v3 pipeline. **PERF.md still shows v2
   numbers** — needs an update after the next corpus run.
4. **CODE_SYSTEM_PROMPT mandates mascot + candy_button + factories** but the four v2
   templates *demonstrate* the v2 manual pattern. The LLM will see both: the mandate
   says "use mascot + candy button + factories" while the template shows
   manually-rolled buttons and direct EduMindAPI calls. Result is uncertain until tested.
   If the LLM follows the prompt mandates, the new validators fire correctly. If it
   follows the template patterns, the new validators reject and repair fires. Either
   path lands at a passing game, but the cleaner solution is to update the v2 templates
   with small factory + mascot + candy edits — deferred as it risks breaking v2 juice.
5. **Flutter web bridge for XP popups not wired.** The bridge's `complete` event now
   returns the XP delta, but the Flutter player screen doesn't yet display an XP popup
   via `GameFeel.xpGain` audio + a visible counter.
6. **Onboarding screen** (first-launch mascot color + daily goal + subject picker) not
   built. New users skip directly to the dashboard.
7. **League leaderboard placeholders** not built. `Student.leagueTier` is computed on
   every XP award, but no `ProfileScreen` league widget shows it.
8. **`refine_patcher` Haiku classifier** doesn't yet have its own test coverage. Should
   add unit tests with mocked Anthropic responses covering all 5 patterns.
9. **`SpecCache` lookup uses `extra` field's `difficulty:` / `length:` regex parsing**
   which is a brittle way to extract preferences. A cleaner approach would have
   preferences as a first-class field on `GenerateRequest`.
10. **The new validators only require 1 mascot call**, not "Pip reacts on every
    correct/wrong/combo/levelComplete". A model could `Mascot.create` once and never
    call `react`. Tighter validation would count react calls.

---

## Push status

Commits about to land:
- All v3 code: schema + routes + cost levers + brand foundation + mascot + widgets + tests
- 47 backend tests pass; Flutter analyze clean
- Prisma migration `20260521121654_v3_storage_xp_streak` applied to Neon
- WHATS_NEW_V3.md and (next pass) PERF.md updates
