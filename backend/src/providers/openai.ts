import OpenAI from 'openai';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import type { ModerationProvider, ModerationVerdict } from './types.ts';

export function createOpenAIModerationProvider(): ModerationProvider {
  const client = new OpenAI({ apiKey: env().EDUMIND_MODERATION_API_KEY });
  const model = env().EDUMIND_MODERATION_MODEL;

  return {
    async check(text, _language): Promise<ModerationVerdict> {
      if (!text.trim()) return { safe: true, categories: [] };
      try {
        const res = await client.moderations.create({ model, input: text });
        const flagged = res.results[0]?.flagged ?? false;
        const cats = res.results[0]?.categories ?? {};
        const flaggedCats = Object.entries(cats)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
        return { safe: !flagged, categories: flaggedCats };
      } catch (err) {
        logger.error({ err }, 'moderation.error');
        // Fail closed: treat moderation failure as unsafe to avoid bypass.
        return { safe: false, categories: ['moderation_error'] };
      }
    },
  };
}
