import type { GameSpec } from '../schemas/gameSpec.ts';
import type { FeedbackEnrichment, Summary } from '../schemas/summary.ts';
import type { NormalizedRequest } from '../schemas/normalizer.ts';

export type GenerationPhase = 'spec' | 'code' | 'repair' | 'feedback' | 'normalize';

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  model: string;
};

export type SpecInput = {
  language: 'en' | 'ar';
  subject: string;
  topic: string;
  style: string;
  theme?: string | undefined;
  extra?: string | undefined;
};

export type GenerationProvider = {
  normalize(
    rawPrompt: string,
    uiLanguage: 'en' | 'ar',
  ): Promise<{ normalized: NormalizedRequest; usage: TokenUsage }>;
  generateSpec(input: SpecInput): Promise<{ spec: GameSpec; usage: TokenUsage }>;
  generateCode(spec: GameSpec, templateHtml: string): Promise<{ innerScript: string; usage: TokenUsage }>;
  generateRepair(
    html: string,
    instruction: string,
    fast: boolean,
  ): Promise<{ html: string; usage: TokenUsage }>;
  generateFeedback(
    summary: Summary,
    language: 'en' | 'ar',
  ): Promise<{ enrichment: FeedbackEnrichment; usage: TokenUsage }>;
};

export type ModerationVerdict = { safe: boolean; categories: string[] };
export type ModerationProvider = {
  check(text: string, language: 'en' | 'ar'): Promise<ModerationVerdict>;
};
