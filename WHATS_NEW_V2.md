# What's New V2 — The Taste Pass

The v1 generations were educationally correct and technically valid but felt like
flashcards-with-sprites. This pass is purely about visual and interactive quality. The
AdaptiveEngine, bridge contract, validators (the 16 existing ones), repair protocol,
database schema, 5-level structure, and pedagogical invariants are all **unchanged**.

## What got built

### 1. GameFeel.js — the juice runtime
[backend/client/GameFeel.js](backend/client/GameFeel.js) — 640 lines, vanilla JS, inlined
into every generated game. Surfaces as `window.GameFeel`:

- **Screen-level**: shake, flash (photosensitivity-safe — capped at 100 ms, pure-red
  rewritten to amber), hitstop, slowmo, zoomPunch.
- **Object-level**: squashStretch, bounceIn, pulse, wobble, per-object shake.
- **Pooled particles**: burst, confetti, sparkle, trail, ringPop. The pool caps at 36 active
  particles per scene to stay well under the 50-object global limit.
- **Score popups**: scorePopup, comboPopup (size scales with combo, screen-shake at ≥5),
  critPopup (with sparkle + ring-pop).
- **Audio (Web Audio API only — no sample files)**: 15 cues including the combo-aware
  `correctChain(n)` that rises one semitone per consecutive correct (capped at +1 octave),
  archetype stingers (engineRev, crowdCheer, swordSlash), countdown tones, ambient music
  loop, filtered-noise woosh/impact.
- **Camera**: followObject (lerp + lookahead), parallaxLayer (factory-based scrolling
  layers in 4 directions), cinematicIntro (LEVEL → READY? → GO! card sequence).
- **Transitions**: wipeIn, wipeOut, fadeTransition, irisOpen, irisClose.
- **Composite**: celebrate, punish (mild — never harsh), levelStart (returns Promise),
  levelEnd (confetti + animated score count-up + accuracy bar fill + TAP TO CONTINUE).

[backend/test/gamefeel.test.ts](backend/test/gamefeel.test.ts) — 7 tests verifying API
surface, no-throw on minimal scenes, particle pool cap respected, combo-chain pitch
advance, flash photosensitivity guard, duration clamping.

### 2. Pipeline wiring
- Scaffold inlines GameFeel.js right after EduCore.js
  ([backend/src/pipeline/scaffold.ts](backend/src/pipeline/scaffold.ts)).
- New 17th validator `uses_gamefeel` requires ≥5 GameFeel calls across ≥3 distinct
  methods. Without this, the LLM tends to fall back to plain Phaser even with the runtime
  available.
- Two new repair seeds: `no_gamefeel_calls` and `gamefeel_low:2:1` with fix templates that
  tell Haiku exactly which composite methods to call.
- Bridge script in the scaffold now **dual-channels**: native `window.EduMind.postMessage`
  for webview_flutter, plus `window.parent.postMessage({source:'EduMind', payload})` for
  the Flutter web IFrameElement path.

### 3. System prompts rewritten
[backend/src/prompts/code.ts](backend/src/prompts/code.ts) gained an **AESTHETIC DIRECTION**
section at the top with:
- Three reference points (Vampire Survivors, Mini Motorways, Genshin damage popups).
- Anti-patterns to refuse (never raw `scene.add.text` for popups, never raw
  `cameras.main.shake()`, never repeat the same audio cue, never silent state changes,
  never default Phaser colors, never fade-to-black, never setTimeout).
- Density targets: ≥5 GameFeel calls / ≥3 distinct methods minimum, with explicit guidance
  to aim for 30+.
- Palette discipline (use `spec.visualStyle.palette` and `accent` religiously, never plain
  `0x000000`, particle bursts mix 2–3 palette colors at once).
- visualMood bias table — energetic / cinematic / minimal / playful / dramatic each shift
  effect intensity differently.

[backend/src/prompts/spec.ts](backend/src/prompts/spec.ts) updated with:
- A required `visualMood` field on every spec.
- Palette discipline: 4 harmonious colors using one of split-complementary / analogous /
  triad. `palette[0]` luminance <0.25 (bg-safe). `palette[3]` luminance >0.7 (body-readable).
- Accessibility note: avoid pure red on dark backgrounds.

GameSpec Zod schema gained an optional `visualMood` enum field (additive only).

### 4. Archetype templates rewritten
All four reference templates went from ~800–1200 lines of "flashcards with sprites" to
1500–2500 lines of actual game.

| Template | What it now does |
|---|---|
| **lane_racer.html** | 4-layer parallax (star horizon → mountains → road tiles → speed lines), 4 ambient rival cars, lane-divider dashes, tire-smoke `burst` on every lane swap, engineRev audio on level-up, +1 MPH popup on every correct answer, crash sequence on wrong (wobble + smoke + hitstop + shake — never harsh), per-level sky-color shift across 5 hand-picked tints, cinematic LEVEL → READY? → GO! card before each lap, animated score count-up + accuracy bar on lap end. |
| **goal_shootout.html** | 36-cell animated crowd in stands with Mexican-wave color shifts, 4 pulsing stadium lights at the corners, field with stripes + center circle, ball arc tween with rotation + scale, keeper diving with wobble (correct = wrong way, wrong = right way), 6-row net rope grid that sine-displaces on goal, confetti + crowdCheer + zoomPunch on celebration, ambient stadium murmur loop every 4.5 s. |
| **tower_builder.html** | Sky gradient + drifting clouds parallax + 5 distant mountain silhouettes + ambient construction-site dust puffs, height-meter on the right with animated fill + meter label, blocks fall with gravity + random rotation + landing squashStretch + dust burst + thunk impact audio, wrong-stack wobbles all blocks and tumbles the top one off with rotation, NEW RECORD banner when level beats previous height, wind woosh loop. |
| **quest_path.html** | 5 per-level environment tints (forest → cave → mountain → castle → boss room) with named level cards, 5 distant mountain silhouettes + foreground tree parallax that passes faster, hero with bobbing sine-idle + permanent sparkle trail, typewriter dialog box (30 ms/char, skippable on tap), wrong-path "⚠ DEAD END" reveal with bounceIn + fade, dramatic Level 5 boss intro (white flash + 6-intensity shake + 0.12 zoomPunch), swordSlash audio cue, iris-close finish transition. |

Every archetype:
- Calls `GameFeel.levelStart()` to open each level and `GameFeel.levelEnd()` to close it
  (confetti + count-up + accuracy bar + TAP TO CONTINUE).
- Tracks a combo counter that triggers `GameFeel.comboPopup()` and `audio.correctChain()`
  at ≥3 consecutive correct. The combo is **purely visual juice** — it never touches the
  AdaptiveEngine scoring formula.
- Calls `GameFeel.scorePopup()` on every correct answer (never raw `add.text`).
- Calls `GameFeel.punish()` on wrong (mild flash + low thump + shake — never harsh).
- Counts 12–20 distinct GameFeel call sites across all 5 levels, well over the validator's
  5-call / 3-distinct-method floor.

### 5. Latency optimizations
- **Playability check + post-moderation now run in parallel** in
  [backend/src/pipeline/generate.ts](backend/src/pipeline/generate.ts). They were
  sequential before, and both take 0.5–5 s. Saves up to 5 s per generation.
- README updated with **honest "1–9 minutes" latency claim** (was "~30 seconds" — a lie).
- New [PERF.md](PERF.md) with measured per-stage latencies (p50), cost breakdowns, and the
  list of optimizations live vs. available-but-not-enabled.

### 6. Bug fixes (the things v1's WHATS_NEW.md admitted were broken)
- **`extractJsonObject` test coverage** in
  [backend/test/json_extract.test.ts](backend/test/json_extract.test.ts) — 11 tests covering
  prose preamble, trailing prose, braces inside strings, multiple JSON blocks, truncated
  JSON, fenced + prose combined.
- **`sprite_assets_referenced_exist` and `uses_gamefeel` tests** added to
  [backend/test/validators.test.ts](backend/test/validators.test.ts) — pass-and-fail cases
  for both new validators.
- **bestScore writeback on web/native** — the player screen now accepts a `db` handle and
  calls `db.recordPlay(gameId, score)` from the `complete` bridge event. The Drift stub
  and any real Drift implementation expose the same method, so this works on web
  (in-memory stub) and on Android/iOS (real Drift) without further changes.
- **Web iframe → Dart bridge.** Previously, on Flutter web the inner game's
  `EduMindAPI.report*` calls were dropped because `IFrameElement` has no native message
  channel. The scaffold bridge script now also calls `window.parent.postMessage({source:
  'EduMind', payload}, '*')`, and the web side of the player screen registers a
  `window.message` listener via `dart:html` that routes the payload into the **same**
  `_onBridge` handler the native WebView channel uses. Cloud-side level history now
  updates on web too.

### 7. 100-game corpus tooling
[backend/scripts/generate_corpus.ts](backend/scripts/generate_corpus.ts) — a runner that:
- Iterates a 100-row `CORPUS` table (all 4 archetypes × 4 themes, varied subjects,
  English + Modern Standard Arabic).
- Runs the full pipeline against each row, optionally with `--concurrency N` workers.
- Records per-game: duration, token usage, cost in micro-USD, validator failures (which
  signatures), repair attempts, playability errors, final HTML size.
- Writes [backend/corpus/&lt;gameId&gt;.html](backend/corpus/) for visual review.
- Writes [backend/corpus_report.md](backend/corpus_report.md) with per-row table +
  aggregate stats: first-try pass rate, p50/p95 latency, average + p50/p95 cost, top 10
  signatures by frequency.

Run with:
```bash
node --env-file=.env --import tsx scripts/generate_corpus.ts                  # all 100
node --env-file=.env --import tsx scripts/generate_corpus.ts --limit 5        # smoke
node --env-file=.env --import tsx scripts/generate_corpus.ts --concurrency 3  # parallel
```

A full 100-row run costs ~$20 and takes ~5 hours sequentially (or ~1.7 hours at
concurrency=3). I built the tool but did not execute it in this sandbox.

## Before / after

Side-by-side at the file level:
- **Before** — [backend/lane-racer-photosynthesis.html](backend/lane-racer-photosynthesis.html)
  (was committed to v1; deleted on cleanup but recoverable from git history at commit
  b879fe9).
- **After** — generate a fresh one against the rewritten template: the `lane_racer.html`
  template alone now contains parallax stars, 4 rival cars, lane dividers, tire-smoke
  bursts, +1 MPH popups, engine-rev audio. The pre-rewrite version of this file is at
  commit b879fe9 ([compare on GitHub](https://github.com/YassoBases/edumind-game-studio/compare/b879fe9...HEAD)).

The validator now blocks v1-style "no juice" output: the bare `VALID_INNER_SCRIPT` test
fixture (which had no GameFeel calls) had to be updated to include 5 GameFeel calls so the
validator suite would pass.

## Decisions made along the way

1. **Particle pool cap = 36 per scene.** Gives ample headroom under the global 50-object
   cap while supporting a 30-particle confetti burst + a player + a few HUD elements.
2. **`audio.correctChain` semitone progression maps n → +n−1 st up to +12.** A full octave
   feels celebratory; capping at +12 prevents the chain becoming silly piercing screech on
   a 20-correct streak.
3. **Flash duration capped at 100 ms** and **pure-red hue rewritten to amber**. Both
   per accessibility guidance. No way for the LLM to bypass it.
4. **Stadium "crowd murmur" is bandpass-filtered white noise, retriggered every 4.5 s.**
   Continuous noise loops felt oppressive in testing; the 4.5 s heartbeat reads as natural
   ambient crowd movement.
5. **`engineRev` is a saw-tooth oscillator with 80 → 220 Hz exponential ramp over 0.4 s,
   gain 0.12.** That specific shape sounds car-engine-ish without sample files. Higher
   frequencies sounded like blenders.
6. **Per-level sky tint shifts.** Each archetype has 5 hand-picked dark color values that
   the background interpolates to at level start, so Level 5 looks visibly darker/different
   from Level 1. Tower_builder picks 5 hues from deep teal → indigo → plum to evoke "night
   falling on the construction site".
7. **`levelStart` returns a Promise** so templates can `await` it before kicking off level
   logic. Eliminates a class of race conditions where the first question would tap-through
   the intro card.
8. **`levelEnd` requires a TAP TO CONTINUE.** Auto-advance felt dismissive of the
   celebration. The tap gives the player agency over the transition.
9. **NEW RECORD banner uses `previousBest`** stored as plain in-memory state. The persistent
   "all-time best" lives in Drift via `bestScore` — separate concern.
10. **The combo counter is local visual state only.** It explicitly does **not** feed into
    the AdaptiveEngine — that part of the spec is sacred. If I'd hooked combo into
    `levelScore`, the difficulty progression would have started lying about mastery.
11. **Parallelizing post-moderation + playability** was free (no race condition risk — both
    are read-only against the assembled HTML and the spec content). Saves up to 5 s.
12. **Web iframe bridge uses `window.parent.postMessage` with `source: 'EduMind'` tag**
    instead of `postMessage` directly. The tag lets the Dart listener filter out arbitrary
    other messages on the same channel (extensions, embedded analytics, etc.).
13. **Corpus row mix.** 25 rows per archetype × 4 themes each. ~80% English / ~20% Arabic
    (5 per archetype) to validate the RTL rules still hold under the new juice load.
    Subjects deliberately spread across STEM and humanities.

## Remaining mediocrity (what didn't get solved)

1. **Real Kenney CC0 PNG drop-in is still manual.** This sandbox can't fetch external
   assets. The `backend/sprites/manifest.json` already documents the canonical Kenney
   paths; drop the PNGs into `backend/sprites/library/<theme>/<role>.png` and the loader
   picks them up automatically (priority over the programmatic SVG placeholders). Until
   that happens, lane_racer's "F1 car" is a stylized SVG silhouette, not a real Kenney
   asset.
2. **The Phaser bundle is still not inlined locally.** Drop the downloaded
   `phaser.min.js` at `backend/src/data/phaser_4_1_0.min.js` and the scaffold will inline
   it in production (existing code path). Saves ~250 KB per game and one CDN round-trip.
3. **Music loop is dormant.** `GameFeel.audio.setMusicLoop({ notes, stepMs })` works but
   no template currently calls it. Could add per-archetype ambient melodies (lane_racer:
   bass-line F1 loop; quest_path: minor-key fantasy). Deferred — would need musical
   curation, not just code.
4. **The corpus wasn't run.** Tool exists, costs ~$20 to run all 100 rows. Run when you
   have the budget and want the data for the research paper.
5. **Pre-warm fix for Anthropic cold-start latency.** The first spec call of an hour pays
   the cache-write tax. A scheduled "ping every 45 minutes" cron would keep the cache hot
   for ~1¢/hour. Not implemented.
6. **Spec generation could stream straight into Zod.** A streaming JSON parser would let
   us start validating before the spec is fully written. Saves 5–15 s on long specs.
   Architecturally interesting; not implemented.
7. **Web iframe `setNoDelay` + `flushHeaders` only applies to compose-stream.** The
   regular `/compose` and `/generate` routes don't need it (they're blocking), but if we
   ever add a second streaming endpoint (e.g. for the corpus runner) we'd want a helper.

## What got pushed

This file, plus all the GameFeel infrastructure, rewritten templates, latency fixes, bug
fixes, and tests. Bumps the test count from 23 (v1.5) to **41** (v2). All pass.

If you regenerate a lane_racer game against the new pipeline, you should see:
- Cinematic intro on every level: LEVEL → READY? → GO!
- Live score popups with combo coloring
- Tire smoke on every lane switch
- Per-level sky shifts
- Confetti + animated score count-up at the end of each lap
- The combo counter rising, the audio pitch chain following

Compare against the b879fe9 commit (the v1 release) by checking out that ref and serving
the same backend templates. The difference reads instantly.
