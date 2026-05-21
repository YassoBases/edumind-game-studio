// Cost lever D — refinement patcher.
// Most refinement requests are 5 common patterns. Patterns 1-4 can be handled by a
// deterministic spec patch + light regeneration; pattern 5 falls back to the full pipeline.
//
// Classification uses a single tiny Haiku call (~50 in / ~50 out tokens, $0.0001).
// The pattern + parameters come back as strict JSON.
//
// Patterns:
//   1. harder        — reduce timeLimitSeconds by 15%, hintsAvailable by 1, difficulty +0.1
//   2. easier        — opposite of harder
//   3. more_questions — add 1-2 contentItems per level
//   4. change_theme  — swap themeId, regenerate sprite manifest only, skip spec+code
//   5. other         — full regeneration (caller handles this)
import * as z from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import { logger } from '../logger.ts';
import { env } from '../env.ts';
import type { GameSpec } from '../schemas/gameSpec.ts';
import { ALL_THEMES, type ThemeId } from '../schemas/archetypes.ts';

export const RefinePatternClassification = z.object({
  pattern: z.enum(['harder', 'easier', 'more_questions', 'change_theme', 'other']),
  newTheme: z.enum(ALL_THEMES).nullable().default(null),
});
export type RefinePatternClassification = z.infer<typeof RefinePatternClassification>;

const CLASSIFY_PROMPT = `You classify EduMind refine instructions into one of:

- harder: student wants more challenge (faster timer, harder questions, fewer hints)
- easier: opposite (more time, simpler questions, more hints)
- more_questions: student wants more content / more variety
- change_theme: student wants a different visual theme. If so, also output newTheme as
  one of the 16 valid theme strings (car_racing_f1, car_racing_street, motorbike, kart,
  football, basketball, hockey, archery, castle, rocket, skyscraper, treehouse, fantasy,
  sci_fi, detective, anime).
- other: anything else — content swap, subject change, format change, etc.

Output ONLY JSON: { "pattern": "<one of the above>", "newTheme": "<valid theme or null>" }
`;

export async function classifyRefine(
  client: Anthropic,
  instruction: string,
): Promise<RefinePatternClassification | null> {
  try {
    const stream = client.messages.stream({
      model: env().EDUMIND_GENERATION_MODEL_FAST,
      max_tokens: 100,
      system: [{ type: 'text', text: CLASSIFY_PROMPT, cache_control: { type: 'ephemeral', ttl: '1h' } }],
      messages: [{ role: 'user', content: 'INSTRUCTION: ' + instruction }],
    });
    const final = await stream.finalMessage();
    const text = final.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const parsed = RefinePatternClassification.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) return null;
    return parsed.data;
  } catch (err) {
    logger.warn({ err }, 'refine.classify_failed');
    return null;
  }
}

export type RefinePatchResult = {
  /** True when the deterministic patch fully applied — caller can skip the heavy LLM steps. */
  applied: boolean;
  spec: GameSpec;
  /** True when the patch only changed the theme (skip both spec and code regeneration). */
  themeOnly: boolean;
  newTheme?: ThemeId | undefined;
};

/**
 * Applies a deterministic patch to a spec. Returns `applied: false` when the pattern is
 * 'other' or otherwise can't be handled deterministically — caller should run the full
 * pipeline in that case.
 */
export function applyRefinePatch(
  spec: GameSpec,
  classification: RefinePatternClassification,
): RefinePatchResult {
  // Deep-ish clone so we don't mutate the caller's spec.
  const next: GameSpec = JSON.parse(JSON.stringify(spec)) as GameSpec;

  switch (classification.pattern) {
    case 'harder': {
      for (const lvl of next.levels) {
        if (lvl.timeLimitSeconds != null && lvl.timeLimitSeconds > 30) {
          lvl.timeLimitSeconds = Math.max(20, Math.round(lvl.timeLimitSeconds * 0.85));
        }
        lvl.hintsAvailable = Math.max(0, lvl.hintsAvailable - 1);
        for (const it of lvl.contentItems) {
          it.difficulty = Math.min(1, it.difficulty + 0.1);
        }
      }
      return { applied: true, spec: next, themeOnly: false };
    }
    case 'easier': {
      for (const lvl of next.levels) {
        if (lvl.timeLimitSeconds != null) {
          lvl.timeLimitSeconds = Math.min(180, Math.round(lvl.timeLimitSeconds * 1.18));
        }
        lvl.hintsAvailable = Math.min(5, lvl.hintsAvailable + 1);
        for (const it of lvl.contentItems) {
          it.difficulty = Math.max(0, it.difficulty - 0.1);
        }
      }
      return { applied: true, spec: next, themeOnly: false };
    }
    case 'more_questions': {
      // Add up to 2 padding items per level by recycling existing ones with id suffixes.
      // This stays under the validators' max-item limits and keeps concepts tagged.
      for (const lvl of next.levels) {
        const source = lvl.contentItems.slice();
        for (let i = 0; i < Math.min(2, source.length); i += 1) {
          const baseItem = source[i];
          if (!baseItem) continue;
          const cloned = JSON.parse(JSON.stringify(baseItem)) as typeof baseItem;
          cloned.id = `${baseItem.id}-bonus${i}`;
          lvl.contentItems.push(cloned);
        }
      }
      return { applied: true, spec: next, themeOnly: false };
    }
    case 'change_theme': {
      if (classification.newTheme) {
        next.themeId = classification.newTheme;
        return { applied: true, spec: next, themeOnly: true, newTheme: classification.newTheme };
      }
      // Theme requested but model didn't pick one — bail to full regen.
      return { applied: false, spec, themeOnly: false };
    }
    case 'other':
    default:
      return { applied: false, spec, themeOnly: false };
  }
}
