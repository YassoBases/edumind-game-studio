import * as z from 'zod';

export const ConceptMastery = z.object({
  conceptId: z.string(),
  conceptLabel: z.string(),
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  mastered: z.boolean(),
});

export const Summary = z.object({
  topic: z.string(),
  subject: z.string(),
  durationSeconds: z.number().int().min(0),
  levelsPlayed: z.number().int().min(0),
  highestLevelReached: z.number().int().min(0),
  masteryAchieved: z.boolean(),
  totalScore: z.number().int().min(0),
  overallAccuracy: z.number().min(0).max(1),
  averageResponseTimeMs: z.number().int().min(0),
  conceptMastery: z.array(ConceptMastery),
  strengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
  recommendedNextTopics: z.array(z.string()),
});
export type Summary = z.infer<typeof Summary>;

export const FeedbackEnrichment = z.object({
  recommendedNextTopics: z.array(z.string()).min(1).max(6),
  strengths: z.array(z.string()),
  growthAreas: z.array(z.string()),
});
export type FeedbackEnrichment = z.infer<typeof FeedbackEnrichment>;

export const LevelReport = z.object({
  level: z.number().int().min(1).max(5),
  score: z.number().min(0).max(1),
  accuracy: z.number().min(0).max(1),
  durationMs: z.number().int().min(0),
});
export type LevelReport = z.infer<typeof LevelReport>;

export const GenerateRequest = z.object({
  studentId: z.string().min(1),
  language: z.enum(['en', 'ar']),
  subject: z.string().min(1).max(60),
  topic: z.string().min(1).max(60),
  style: z.enum([
    'memory_match',
    'sorting_puzzle',
    'quick_reflexes',
    'build_something',
    'story_quest',
    'step_by_step',
  ]),
  theme: z.string().max(40).optional(),
  extra: z.string().max(120).optional(),
  idempotencyKey: z.string().min(1).max(80),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;
