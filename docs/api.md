# HTTP API reference

All routes mounted at `/api/games`. Base URL in dev: `http://localhost:8080`.

## Auth

Pass the student identifier via header:

```
x-student-id: demo-student
```

There's no token / signature yet — this is a development surface. Wire up your auth
provider in `server.ts` before deploying.

## Rate limiting

10 generation requests per student per day, keyed on `x-student-id`. Configurable via
`RATE_LIMIT_PER_STUDENT_PER_DAY` env.

---

## POST `/api/games/compose-stream`

Server-Sent Events. The dashboard's preferred endpoint.

### Request

```http
POST /api/games/compose-stream
content-type: application/json
x-student-id: demo-student
accept: text/event-stream

{
  "rawPrompt": "idk i like racing and plants",
  "language": "en",
  "preferences": {
    "difficulty": "medium",        // easy | medium | hard | challenge
    "sessionLength": "standard",   // quick | standard | long
    "grade": 9,                    // 7..12
    "focusArea": "light reactions" // optional, ≤80 chars
  }
}
```

### Response — event stream

```
event: open
data: {"startedAt":"2026-05-16T15:58:42.129Z"}

event: stage
data: {"stage":"normalize","label":"Reading your prompt","status":"end",
       "latencyMs":1180,"costMicroUsd":109,
       "detail":{"archetype":"lane_racer","theme":"car_racing_f1","confidence":0.92}}

event: stage
data: {"stage":"moderation_pre","label":"Safety check","status":"start","costMicroUsd":109}

event: stage
data: {"stage":"moderation_pre","label":"Safety check","status":"end",
       "latencyMs":520,"costMicroUsd":109}

event: stage
data: {"stage":"spec","label":"Designing the game","status":"start","costMicroUsd":109}

...

event: stage
data: {"stage":"done","label":"Ready","status":"end","costMicroUsd":78342}

event: done
data: {"gameId":"cmp8gqvdb...","orientation":"landscape","language":"en",
       "html":"<!DOCTYPE html>...","totalCostMicroUsd":78342,
       "normalized":{...}}
```

### Terminal events

| Event | When | Payload shape |
|---|---|---|
| `done` | Pipeline succeeded | `{ gameId, orientation, language, html, totalCostMicroUsd, normalized }` |
| `clarify` | Normalizer confidence < 0.6 | `{ clarifyingQuestion, suggestedArchetype, suggestedTheme, normalized }` |
| `error` | Anything threw | `{ message }` |

`costMicroUsd` is **cumulative running cost in micro-USD** (1 USD = 1 000 000 micro-USD).
A typical generation lands around 70 000–200 000 micro-USD (7–20¢).

`detail` carries stage-specific debug info: token counts, validator failure signatures,
playability error list, etc.

---

## POST `/api/games/compose`

Blocking version of `/compose-stream`. Returns once or fails. Useful for non-browser
clients and curl smoke tests.

### Request

Same body as `/compose-stream`.

### Response 200 — generation succeeded

```json
{
  "gameId": "cmp8gqvdb0002up9swhb42ibl",
  "orientation": "landscape",
  "language": "en",
  "html": "<!DOCTYPE html>...",
  "normalized": { "archetype": "lane_racer", "theme": "car_racing_f1", ... }
}
```

### Response 200 — needs clarification

```json
{
  "needsClarification": true,
  "clarifyingQuestion": "Do you want to learn about plant biology or something else?",
  "suggestedArchetype": "lane_racer",
  "suggestedTheme": "car_racing_f1",
  "normalized": { ... }
}
```

### Response 400

```json
{ "error": "safety_flagged", "flags": ["violence"], "clarifyingQuestion": null }
```

---

## POST `/api/games/generate`

Legacy. Skip the normalizer; pass a structured request directly. Used by automated tests
and the older Flutter composer.

### Request

```json
{
  "studentId": "demo-student",
  "language": "en",
  "subject": "Biology",
  "topic": "Photosynthesis",
  "style": "memory_match",
  "theme": "lab",
  "extra": "focus on Calvin cycle",
  "idempotencyKey": "abc123"
}
```

`style` ∈ `memory_match | sorting_puzzle | quick_reflexes | build_something | story_quest | step_by_step`.

Headers: `x-student-id`, `idempotency-key` (optional — auto-derived from student+timestamp).

### Response 200

```json
{
  "gameId": "...",
  "orientation": "portrait",
  "language": "en",
  "html": "<!DOCTYPE html>..."
}
```

If the same `idempotency-key` is sent within 24h, returns the cached game with `cached: true`.

---

## POST `/api/games/:id/refine`

Haiku-only spec edit on an existing game. Used by the `RefineModal` bottom sheet.

### Request

```json
{ "instruction": "Make the last level harder and switch the theme to motorbike" }
```

### Response 200

```json
{ "gameId": "<same id>", "html": "<rewritten HTML>" }
```

Cost: ~0.5–1¢ per refinement.

---

## POST `/api/games/:id/level`

Per-level performance write-back from the JS bridge inside the game.

### Request

```json
{ "level": 3, "score": 0.82, "accuracy": 0.8, "durationMs": 42000 }
```

### Response 200

```json
{ "ok": true }
```

Updates `LevelRecord` and increments `ConceptMastery` for every concept touched in that
level (attempts += contentItems.length, correct += round(attempts × accuracy)).

---

## POST `/api/games/:id/complete`

Session-end summary write-back. Fires async Haiku enrichment.

### Request — full Summary payload

```json
{
  "topic": "Photosynthesis",
  "subject": "Biology",
  "durationSeconds": 380,
  "levelsPlayed": 5,
  "highestLevelReached": 5,
  "masteryAchieved": true,
  "totalScore": 420,
  "overallAccuracy": 0.78,
  "averageResponseTimeMs": 4200,
  "conceptMastery": [
    { "conceptId": "overall_equation", "conceptLabel": "...",
      "attempts": 8, "correct": 7, "mastered": true },
    ...
  ],
  "strengths": ["Calvin cycle"],
  "growthAreas": ["Light reactions"],
  "recommendedNextTopics": []
}
```

### Response 200

```json
{ "summaryId": "<cuid>", "enrichmentReady": false }
```

Async enrichment runs in the background: Haiku 4.5 reads the summary and writes back to
the `Summary.enrichment` column with `enrichmentReady: true`. Poll `GET /:id/summary`
for the result.

---

## GET `/api/games/:id/summary`

Poll for async enrichment.

### Response 200

```json
{
  "payload": { ... },                           // the Summary as written by /complete
  "enrichment": {
    "recommendedNextTopics": ["Cellular respiration", "Photorespiration"],
    "strengths": ["Strong on the Calvin cycle"],
    "growthAreas": ["Could practice light-dependent reactions"]
  },
  "enrichmentReady": true
}
```

Flutter polls every 1.5 s, max 4 attempts (~6 s total) before falling back to the raw
summary fields.

---

## GET `/api/games/library`

Per-student game list, newest first, max 50.

### Response 200

```json
{
  "games": [
    {
      "id": "cmp...",
      "topic": "Photosynthesis",
      "subject": "Biology",
      "language": "en",
      "templateId": "target_practice",
      "createdAt": "2026-05-16T15:58:42.129Z"
    },
    ...
  ]
}
```

---

## GET `/health`

```json
{ "status": "ok", "db": "ok", "ts": "2026-05-16T..." }
```

`db` is `down` if Prisma can't `SELECT 1`. Status is `degraded` whenever any subsystem is
down; `ok` only when everything is healthy.

---

## Errors

All non-2xx responses follow:

```json
{ "error": "BadRequest", "message": "Human-readable explanation" }
```

`statusCode` is in the HTTP status. Specific codes:

| Status | Reason |
|---|---|
| `400` | Invalid request body (Zod failure), moderation rejected, normalizer safety-flagged |
| `401` | Missing `x-student-id` |
| `403` | Forbidden (e.g. refining someone else's game) |
| `404` | Game / summary not found |
| `422` | Generated content failed post-moderation |
| `500` | Pipeline error (spec gen failure after retries, repair max reached, etc.) |

The body's `message` for 5xx errors is `"Internal error"` to avoid leaking implementation
details. Full error detail is in the server logs.

---

## JS bridge contract (inside a generated game)

Generated games **must** call these via `window.EduMindAPI.*`:

```js
EduMindAPI.reportScore(value)                            // per correct answer
EduMindAPI.reportLevel(level, score, accuracy, ms)       // per level end
EduMindAPI.reportSummary(summaryPayload)                 // session end, FIRST
EduMindAPI.reportComplete(score, won, time)              // session end, SECOND
EduMindAPI.reportEvent(name, data)                       // custom analytics
```

Validator `bridge_calls_present` rejects code missing `reportLevel`, `reportSummary`,
or `reportComplete`. Order matters: summary must fire before complete.

The Flutter host registers a `JavaScriptChannel('EduMind', ...)` that receives JSON of
the shape `{ event, data, name? }` and forwards `level` / `complete` events to the
backend.
