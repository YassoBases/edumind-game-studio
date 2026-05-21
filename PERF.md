# Performance

Measured per-stage latencies for the EduMind generation pipeline. Numbers are p50 from
the corpus runs (`backend/scripts/generate_corpus.ts`) unless noted.

## End-to-end target

| Path | Latency |
|---|---|
| Cold-cache, no images | 3–5 min |
| Hot-cache (≤ 1h since last call), no images | 1.5–3 min |
| Cold-cache, with Flux Schnell images | 4–9 min |
| Hot-cache, with images | 2–5 min |

## Per-stage breakdown

| Stage | Latency (p50) | Cost (p50) | Knobs |
|---|---|---|---|
| Normalize (Haiku 4.5) | 1.0–1.5 s | 0.1¢ | Cache the system prompt (already 1h); only invoked on `/compose-stream`. |
| Pre-moderation (OpenAI) | 0.4–0.8 s | free | None — fast and free. |
| Spec generation (Sonnet 4.6) | 45–90 s | 5–8¢ | Cache the system prompt (1h). Soft-clip `explanationOnWrong` to 120 chars before validation (prevents bouncing on minor overshoot). |
| Sprite compose (library) | 5–10 ms | 0 | None — filesystem lookup + SVG fallback. |
| Sprite compose (with Flux) | 12–25 s | ~1.5¢ | Run in parallel with the code call (already does). Cap concept icons at 6 per game. |
| Code generation (Sonnet 4.6) | 90–150 s | 10–14¢ | Cache the system prompt AND the template HTML (both 1h). Single biggest latency contributor. |
| Validators (16, in parallel) | 5–15 ms | free | None — all regex/string ops. |
| Repair (when needed) | 60–130 s/attempt | ~0.5¢ | Most failures auto-patch via regex (free + instant). LLM repair fires only on signatures without `auto_patch`. Promote signatures by frequency. |
| Playability (Playwright Chromium) | 4–6 s | free | Cache `chromium` browser process via a pool (already does, cap 4 contexts). In prod, sample at 20% (`PLAYABILITY_SAMPLE_RATE_PROD=0.2`). |
| Post-moderation | 0.4–0.8 s | free | Now runs in parallel with playability (was sequential pre-v2). |
| Persist (Prisma → Neon) | 30–80 ms | free | Use the pooler URL (`?pgbouncer=true`) to survive ~2 min idle-suspend during LLM calls. |

## Optimizations live as of v2

- **Prompt caching at 1h.** Every Anthropic system+template breakpoint sends
  `cache_control: { type: 'ephemeral', ttl: '1h' }`. The default 5-minute TTL misses most
  reads in distributed traffic and multiplies cost ~10×. Logger emits
  `cache.below_threshold` when read ratio < 0.7.
- **Streaming on every call.** `client.messages.stream().finalMessage()` is used unconditionally
  so repair calls (24 000 max_tokens) don't trip Anthropic's 10-minute pre-flight rejection.
- **Sprite compose in parallel with code generation.** Cuts ~20 s off the AI-image path.
- **Playability + post-moderation in parallel.** Saves 0.5–5 s.
- **Touch-target validator scopes to `setInteractive` shapes only.** Stops false-positive
  repair loops on decorative shapes (progress fills, particles, lane dividers).
- **Soft-clip `explanationOnWrong` / `prompt`** before validation. Prevents bouncing the
  whole pipeline for a 30-char overshoot.
- **Anthropic retry on 529 / 5xx / 429** with 2 / 5 / 12 / 25 s backoff. Lifts most
  transient overloads silently.
- **SSE compose-stream** with `reply.hijack()` + `flushHeaders()` + `setNoDelay(true)` so
  each frame flushes immediately — dashboards see live progress instead of waiting for the
  whole stream to close.

## Optimizations available but not yet enabled

| Optimization | Estimated saving | Status |
|---|---|---|
| Inline Phaser 4.1.0 bundle (drop at `backend/src/data/phaser_4_1_0.min.js`) | 200–400 ms per game (no CDN round-trip) + ~250 KB response shrink in production | Not bundled — placeholder file path supported by scaffold. Drop the file in to enable. |
| Phaser pre-warm: Playwright keeps a warm Chromium browser process between checks | 1–2 s per playability check | Already implemented via `BrowserPool`. |
| Stream the spec generation directly into Zod parsing | 5–15 s on long specs | Not implemented. Would need a streaming JSON parser. |
| Use the Anthropic batch API for offline corpus generation | Same wall time, 50% cost discount | Not implemented. Only matters for the 100-game corpus, not production. |

## Cost budget

### v3 (current, after 5 cost levers — projected based on architecture, see WHATS_NEW_V3 §"Remaining mediocrity")

Per generation, no AI images:

| Stage | v2 cost | v3 cost | Lever |
|---|---|---|---|
| Normalize (Haiku) | ~0.1¢ | ~0.1¢ | — |
| Spec call | ~7.5¢ | ~2.5¢ | A (Haiku for simple) + B (24h cache) |
| Code call | ~12¢ | ~5¢ | C (factories drop 7.5K→4.5K output tokens) + E (tighter cache breakpoints) |
| Repair | ~0.5¢ | ~0.5¢ | unchanged |
| **Total** | **~20¢** | **~8¢** | **62% reduction target** |

Per generation with Flux Schnell images: + ~2¢ (unchanged).
Per refinement (after Lever D):
- Patterns 1-3 (harder/easier/more_questions): ~5¢ (deterministic patch + code regen)
- Pattern 4 (change_theme): **~$0** (sprite manifest swap + scaffold rewrap, no LLM call)
- Pattern 5 (other): same as a full generation (~8¢)

### v2 (previous, measured)

Per generation, no AI images:
- Spec call: ~7¢
- Code call: ~12¢
- **Total: ~19¢** (p50)

Per generation, with Flux Schnell images:
- + 1 background + up to 6 concept icons = ~2.1¢
- **Total: ~21¢** with images, **15¢/game hard-cap** in `backend/src/sprites/generated.ts`.

Skipping `EDUMIND_GENERATION_CACHE_TTL=1h` raises the cost ~10×. Don't.
