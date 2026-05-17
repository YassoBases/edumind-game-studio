import * as z from 'zod';
import { ARCHETYPE_IDS, ALL_THEMES } from './archetypes.ts';

export const NormalizedRequest = z.object({
  subject: z.string().min(1).max(60),
  topic: z.string().min(1).max(80),
  archetype: z.enum(ARCHETYPE_IDS),
  theme: z.enum(ALL_THEMES),
  language: z.enum(['en', 'ar']),
  studentInterests: z.array(z.string()).max(6).default([]),
  confidence: z.number().min(0).max(1),
  clarifyingQuestion: z.string().nullable().default(null),
  safetyFlags: z.array(z.string()).default([]),
});
export type NormalizedRequest = z.infer<typeof NormalizedRequest>;

export const RawComposeRequest = z.object({
  rawPrompt: z.string().min(2).max(400),
  language: z.enum(['en', 'ar']).default('en'),
});
export type RawComposeRequest = z.infer<typeof RawComposeRequest>;
