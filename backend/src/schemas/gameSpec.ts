import * as z from 'zod';
import { ALL_THEMES, ARCHETYPE_IDS, themeBelongsToArchetype, type ArchetypeId, type ThemeId } from './archetypes.ts';

export const TEMPLATE_IDS = [
  'match_pairs',
  'sort_categorize',
  'sequence',
  'target_practice',
  'build_combine',
  'quiz_quest',
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const ContentItem = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  answer: z.union([z.string(), z.array(z.string()).min(1)]),
  distractors: z.array(z.string()).optional(),
  concepts: z.array(z.string()).min(1),
  difficulty: z.number().min(0).max(1),
  explanationOnWrong: z.string().max(120),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const LevelSpec = z.object({
  index: z.number().int().min(1).max(5),
  name: z.string().min(1),
  timeLimitSeconds: z.number().int().positive().nullable(),
  hintsAvailable: z.number().int().min(0).max(5),
  contentItems: z.array(ContentItem).min(3),
  passingScore: z.number().min(0).max(1).default(0.6),
});
export type LevelSpec = z.infer<typeof LevelSpec>;

export const Concept = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
});

export const GameSpec = z
  .object({
    templateId: z.enum(TEMPLATE_IDS),
    // Archetype is the *presentation skin*. Optional for backwards-compat: legacy specs
    // without it still validate and run against the original templates/.
    archetype: z.enum(ARCHETYPE_IDS).optional(),
    language: z.enum(['en', 'ar']),
    subject: z.string().min(1),
    topic: z.string().min(1),
    // Free-text theme stays — older specs use this. New archetype path uses themeId.
    theme: z.string().min(1),
    themeId: z.enum(ALL_THEMES).optional(),
    orientation: z.enum(['portrait', 'landscape']),
    concepts: z.array(Concept).min(2),
    levels: z.tuple([LevelSpec, LevelSpec, LevelSpec, LevelSpec, LevelSpec]),
    feedback: z.object({
      correctPool: z.array(z.string()).min(3),
      wrongPool: z.array(z.string()).min(3),
      levelComplete: z.array(z.string()).min(2),
    }),
    visualStyle: z.object({
      palette: z.tuple([z.string(), z.string(), z.string(), z.string()]),
      accent: z.string(),
    }),
    audioCues: z.array(z.enum(['correct', 'wrong', 'win', 'lose', 'tick', 'levelUp'])),
  })
  .refine((s) => s.levels.reduce((sum, l) => sum + l.contentItems.length, 0) >= 25, {
    message: 'Spec must contain at least 25 content items across 5 levels',
    path: ['levels'],
  })
  .refine(
    (s) => {
      const conceptIds = new Set(s.concepts.map((c) => c.id));
      for (const lvl of s.levels) {
        for (const it of lvl.contentItems) {
          for (const c of it.concepts) if (!conceptIds.has(c)) return false;
        }
      }
      return true;
    },
    { message: 'Every contentItem.concepts ID must match an entry in spec.concepts', path: ['levels'] },
  )
  .refine(
    (s) => {
      if (!s.archetype || !s.themeId) return true;
      return themeBelongsToArchetype(s.themeId as ThemeId, s.archetype as ArchetypeId);
    },
    { message: 'themeId must belong to the chosen archetype', path: ['themeId'] },
  );
export type GameSpec = z.infer<typeof GameSpec>;

export function levelIndexes(spec: GameSpec): readonly [1, 2, 3, 4, 5] {
  return [1, 2, 3, 4, 5] as const;
}
