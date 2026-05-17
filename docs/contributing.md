# Contributing

## Dev setup

### Backend

```bash
cd backend
npm install --legacy-peer-deps
cp .env.example .env  # fill in keys
npx prisma generate
npx prisma migrate deploy
npx playwright install chromium

# Run with auto-reload
node --env-file=.env --import tsx --watch src/server.ts
```

Required Node: 20+. Spec'd as 24 LTS but works on 22 / 20 with a harmless `EBADENGINE`
warning.

### Flutter

```bash
cd flutter_module
flutter pub get
flutter run -d chrome --web-port 5173 --dart-define=BACKEND_URL=http://localhost:8080
```

Or native:

```bash
flutter run -d <android-device-id>
```

Spec'd as Flutter 3.41 / Dart 3.11 but works on 3.19+ / 3.3+ with constraint loosening in
`pubspec.yaml`.

---

## Quality bar

Before opening a PR:

```bash
cd backend
npm test                # 16 tests, must pass
npx tsc --noEmit        # strict TS, must be clean
npm run lint            # Biome — must be clean
```

```bash
cd flutter_module
dart analyze lib/       # must be clean (warnings allowed; errors not)
```

If you touched the pipeline or providers, run a real smoke test:

```bash
curl -X POST http://localhost:8080/api/games/compose \
  -H "content-type: application/json" \
  -H "x-student-id: dev" \
  -d '{"rawPrompt":"car racing game about photosynthesis","language":"en"}'
```

Should return HTTP 200 within ~5 minutes.

---

## Coding style

### TypeScript

- **Strict mode** is non-negotiable. No `any` in public APIs — narrow `unknown` instead.
- **`exactOptionalPropertyTypes: true`**. Spread conditionally rather than passing
  `undefined`:
  ```ts
  await prisma.foo.create({ data: { id, ...(opt ? { opt } : {}) } });
  ```
- **ESM only** with explicit `.ts` extensions in imports.
- **Zod 4**: `import * as z from "zod"` (not `import { z }`).
- **No barrel files** unless the module is meant as a public API (e.g.
  `flutter_module/lib/features/game_studio/game_studio.dart`).

### Dart / Flutter

- **Match the design system** in `theme.dart`. Use `EduTheme.*` and `EduCurves.*`,
  don't reach for Material defaults.
- **GlassCard** for surfaces. No vanilla `Card`.
- **flutter_animate** for microinteractions; keep durations under 600ms.
- **Bilingual everywhere**: every user-facing string must have an `ar` variant.
- **State**: `StatefulWidget` is fine for screen-local state. Don't add Riverpod / Bloc /
  Provider unless you're working on something that genuinely needs cross-screen state.

### Validators

If you add a validator:

1. Return a deterministic `signature`. The signature is the lookup key for the repair
   protocol — name it like `category:detail` (e.g. `phaser3_api:setTintFill`).
2. Always return `ok: true` with a "passed" signature too. Validators always emit results;
   the pipeline filters by `ok`.
3. Add a unit test in `backend/test/validators.test.ts`.
4. Seed a repair entry in `backend/src/data/repair_protocol.json` — either an `auto_patch`
   or a `fix_template` to feed Haiku.

### Repair protocol

- `auto_patch` types: `regex_replace`, `inject_before`, `inject_after`. Test the regex
  against an example failure before committing.
- New entries discovered at runtime are appended with `verified: false`. Set to `true`
  only after a human has reviewed the fix.

---

## Adding an archetype

1. Drop a reference template at `backend/templates/<name>.html`. Copy an existing archetype
   as a starting point — keep the 3-scene structure, `AdaptiveEngine.create()`, the
   bridge calls, and `EduCore.showLevelComplete()` between levels.
2. Add to `ARCHETYPE_IDS`, `THEMES_BY_ARCHETYPE`, `ARCHETYPE_TO_TEMPLATE`, and
   `DEFAULT_THEMES` in [backend/src/schemas/archetypes.ts](../backend/src/schemas/archetypes.ts).
3. Add the archetype to the normalizer prompt in
   [backend/src/prompts/normalizer.ts](../backend/src/prompts/normalizer.ts).
4. Add archetype-aware language in
   [backend/src/prompts/code.ts](../backend/src/prompts/code.ts).
5. Add sprite roles in [backend/sprites/manifest.json](../backend/sprites/manifest.json)
   for each theme and update `defaultRolesFor` + the placeholder builders in
   [backend/src/sprites/placeholders.ts](../backend/src/sprites/placeholders.ts).
6. Smoke test with `/compose`. Verify Playwright playability passes.

---

## Adding a system prompt

All system prompts are **cached at 1h**. Always include:

```ts
{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } }
```

Updating a system prompt invalidates the cache. Roll prompts in low-traffic windows.
Future improvement: write to the `PromptVersion` table so we can roll back.

---

## Commits

Conventional commits aren't required but appreciated:

```
feat(archetype): add lane_racer with car_racing_f1 theme
fix(validator): touch_target_size now ignores Phaser shape rotation
chore(repair): seed sprite_size_exceeded entry
docs(api): document SSE compose-stream event shapes
```

Keep commits focused. One PR = one cohesive change. If your change touches both a
pedagogical template and an archetype, that's two PRs.

---

## Pull request checklist

- [ ] `npm test` green
- [ ] `tsc --noEmit` clean
- [ ] `dart analyze` clean (if touching Flutter)
- [ ] Real `/compose` smoke test runs to completion
- [ ] If you added a validator: unit test + repair entry seeded
- [ ] If you added an archetype: all 4 stages pass (spec, code, validators, playability)
- [ ] If you touched the bridge contract: backwards-compat unless explicitly versioned
- [ ] If you touched `AdaptiveEngine`: every adaptive test still passes
- [ ] WHATS_NEW.md updated with what was added / changed / kept

---

## Don'ts

- **Don't bypass validators.** Adding `// validator-ignore` comments etc. The repair
  protocol is how we handle exceptions.
- **Don't add new scenes.** Three scenes per game. Period.
- **Don't ship games with external resource fetches.** Phaser CDN tag is the only
  exception, and only in dev. Production scaffold inlines the bundle.
- **Don't commit `.env`** — `.gitignore` already excludes it, but double-check before
  pushing.
- **Don't commit Kenney PNGs.** Drop them into your local
  `backend/sprites/library/<theme>/` for testing, but the `.gitignore` excludes them so
  the upstream stays size-bounded. Document the source PNGs in your PR.

---

## Filing issues

- **Bug** — include the request body, full server log, and the failure signature if
  validators / repair / playability fired.
- **Feature** — describe the student-facing benefit, then the proposed surface (route,
  prompt change, validator, etc).
- **Cost regression** — paste the `llm.call` log lines with `cacheReadRatio` for the
  affected stage.
