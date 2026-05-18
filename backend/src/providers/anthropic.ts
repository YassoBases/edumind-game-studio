import Anthropic from '@anthropic-ai/sdk';
import { env } from '../env.ts';
import { logger, logLLMCall } from '../logger.ts';
import { SPEC_SYSTEM_PROMPT } from '../prompts/spec.ts';
import { CODE_SYSTEM_PROMPT } from '../prompts/code.ts';
import { REFINE_SYSTEM_PROMPT } from '../prompts/refine.ts';
import { FEEDBACK_SYSTEM_PROMPT } from '../prompts/feedback.ts';
import { NORMALIZER_SYSTEM_PROMPT } from '../prompts/normalizer.ts';
import { GameSpec, type GameSpec as GameSpecT } from '../schemas/gameSpec.ts';
import { FeedbackEnrichment, type FeedbackEnrichment as FeedbackEnrichmentT, type Summary } from '../schemas/summary.ts';
import { NormalizedRequest } from '../schemas/normalizer.ts';
import type { GenerationProvider, GenerationPhase, SpecInput, TokenUsage } from './types.ts';
import { stripFences, extractJsonObject } from '../pipeline/strip.ts';

type CacheControl = { type: 'ephemeral'; ttl: '5m' | '1h' };
function cc(): CacheControl {
  return { type: 'ephemeral', ttl: env().EDUMIND_GENERATION_CACHE_TTL };
}

// Soft-truncate frequently-overshot string fields before validation. The cap stays meaningful
// (so models don't write paragraphs), we just don't bounce the whole pipeline for a 30-char overshoot.
function clip(s: unknown, max: number): unknown {
  if (typeof s !== 'string') return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
function softTruncateSpec(json: unknown): void {
  if (!json || typeof json !== 'object') return;
  const j = json as { levels?: Array<{ contentItems?: Array<{ explanationOnWrong?: unknown; prompt?: unknown }> }> };
  if (!Array.isArray(j.levels)) return;
  for (const lvl of j.levels) {
    if (!lvl?.contentItems) continue;
    for (const it of lvl.contentItems) {
      if (it.explanationOnWrong !== undefined) it.explanationOnWrong = clip(it.explanationOnWrong, 120);
      if (it.prompt !== undefined) it.prompt = clip(it.prompt, 240);
    }
  }
}

export function createAnthropicProvider(): GenerationProvider {
  const client = new Anthropic({ apiKey: env().EDUMIND_GENERATION_API_KEY });
  const primary = env().EDUMIND_GENERATION_MODEL_PRIMARY;
  const fast = env().EDUMIND_GENERATION_MODEL_FAST;

  // Backoff schedule for transient 529/overloaded/rate-limit errors from Anthropic.
  // Anthropic's overloaded errors are typically resolved within 10–30 seconds.
  const RETRY_DELAYS_MS = [2000, 5000, 12000, 25000];

  function isRetryableAnthropicError(err: unknown): boolean {
    const e = err as { status?: number; error?: { type?: string }; message?: string };
    if (e.status === 529) return true;
    if (e.status === 502 || e.status === 503 || e.status === 504) return true;
    if (e.status === 429) return true;
    if (e.error?.type === 'overloaded_error') return true;
    if (e.error?.type === 'rate_limit_error') return true;
    if (typeof e.message === 'string' && /overloaded|rate.?limit|temporarily/i.test(e.message)) return true;
    return false;
  }

  async function call(
    model: string,
    system: Array<{ type: 'text'; text: string; cache_control?: CacheControl }>,
    userText: string,
    phase: GenerationPhase,
    maxTokens = 16000,
  ): Promise<{ text: string; usage: TokenUsage }> {
    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= RETRY_DELAYS_MS.length) {
      const t0 = Date.now();
      try {
        // Streaming on every call — Anthropic's non-stream pre-flight rejects requests
        // whose max_tokens could exceed a 10-minute wall clock.
        const stream = client.messages.stream({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: userText }],
        });
        const finalMessage = await stream.finalMessage();
        const latency = Date.now() - t0;
        const usage: TokenUsage = {
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
          cacheReadTokens: finalMessage.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: finalMessage.usage.cache_creation_input_tokens ?? 0,
          model,
        };
        logLLMCall({ phase, latencyMs: latency, ...usage });
        const text = finalMessage.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        return { text, usage };
      } catch (err) {
        lastErr = err;
        if (!isRetryableAnthropicError(err) || attempt >= RETRY_DELAYS_MS.length) {
          throw err;
        }
        const delay = RETRY_DELAYS_MS[attempt] ?? 25000;
        const status = (err as { status?: number }).status ?? '?';
        const type = (err as { error?: { type?: string } }).error?.type ?? '?';
        logger.warn(
          { phase, model, attempt: attempt + 1, status, type, delayMs: delay },
          'llm.retry',
        );
        await new Promise((r) => setTimeout(r, delay));
        attempt += 1;
      }
    }
    throw lastErr ?? new Error('LLM call failed');
  }

  return {
    async normalize(rawPrompt, uiLanguage) {
      const system = [{ type: 'text' as const, text: NORMALIZER_SYSTEM_PROMPT, cache_control: cc() }];
      const userText = `UI_LANGUAGE: ${uiLanguage}\nSTUDENT_PROMPT: ${rawPrompt}`;
      const { text, usage } = await call(fast, system, userText, 'normalize', 800);
      const raw = extractJsonObject(stripFences(text));
      const parsed = NormalizedRequest.parse(JSON.parse(raw));
      return { normalized: parsed, usage };
    },

    async generateSpec(input: SpecInput) {
      const userText = JSON.stringify(
        {
          language: input.language,
          subject: input.subject,
          topic: input.topic,
          style: input.style,
          theme: input.theme ?? null,
          extra: input.extra ?? null,
          themeId_allowed_values:
            'car_racing_f1, car_racing_street, motorbike, kart, football, basketball, hockey, archery, castle, rocket, skyscraper, treehouse, fantasy, sci_fi, detective, anime',
          themeId_hint:
            'When you set spec.themeId, it MUST be exactly one of the allowed values above. Do NOT invent new strings.',
        },
        null,
        2,
      );

      let attempt = 0;
      let lastErr: unknown = null;
      while (attempt < 2) {
        attempt += 1;
        const system = [{ type: 'text' as const, text: SPEC_SYSTEM_PROMPT, cache_control: cc() }];
        const prompt =
          attempt === 1
            ? userText
            : `${userText}\n\nPREVIOUS_ATTEMPT_ERRORS:\n${String(lastErr)}\nReturn a corrected JSON.`;
        const { text, usage } = await call(primary, system, prompt, 'spec');
        const raw = extractJsonObject(stripFences(text));
        try {
          const json = JSON.parse(raw);
          softTruncateSpec(json);
          const parsed = GameSpec.safeParse(json);
          if (parsed.success) return { spec: parsed.data, usage };
          lastErr = JSON.stringify(parsed.error.issues.slice(0, 5));
        } catch (e) {
          lastErr = e instanceof Error ? e.message : String(e);
        }
        logger.warn({ attempt, lastErr }, 'spec.validation_failed');
      }
      throw new Error(`Spec generation failed after 2 attempts: ${String(lastErr)}`);
    },

    async generateCode(spec: GameSpecT, templateHtml: string) {
      const system = [
        { type: 'text' as const, text: CODE_SYSTEM_PROMPT, cache_control: cc() },
        { type: 'text' as const, text: templateHtml, cache_control: cc() },
      ];
      const userText = `Generate the inner-script JS for the following spec. Return ONLY JS, no fences.\n\nSPEC:\n${JSON.stringify(spec)}`;
      const { text, usage } = await call(primary, system, userText, 'code');
      const innerScript = stripFences(text);
      return { innerScript, usage };
    },

    async generateRepair(html: string, instruction: string, useFast: boolean) {
      const system = [{ type: 'text' as const, text: REFINE_SYSTEM_PROMPT, cache_control: cc() }];
      const userText = `INSTRUCTION:\n${instruction}\n\nCURRENT_HTML:\n${html}`;
      const model = useFast ? fast : primary;
      const { text, usage } = await call(model, system, userText, 'repair', 24000);
      return { html: stripFences(text), usage };
    },

    async generateFeedback(summary: Summary, language: 'en' | 'ar') {
      const system = [{ type: 'text' as const, text: FEEDBACK_SYSTEM_PROMPT, cache_control: cc() }];
      const userText = `LANGUAGE: ${language}\nSUMMARY:\n${JSON.stringify(summary)}`;
      const { text, usage } = await call(fast, system, userText, 'feedback', 1200);
      const raw = extractJsonObject(stripFences(text));
      const json = JSON.parse(raw);
      const parsed = FeedbackEnrichment.parse(json) as FeedbackEnrichmentT;
      return { enrichment: parsed, usage };
    },
  };
}
