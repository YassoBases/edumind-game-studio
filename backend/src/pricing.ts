// Live cost calculator for LLM + image-generation calls.
// Prices in USD per 1M tokens; final cost expressed in *micro-USD* (1 USD = 1e6 micro-USD)
// so we can sum many calls in integer-friendly numbers without floating-point error.

import type { TokenUsage } from './providers/types.ts';

type ModelPrice = {
  inputPerM: number;   // $/1M input tokens
  outputPerM: number;  // $/1M output tokens
  cacheWriteMultiplier1h: number; // multiplier on inputPerM for 1h ephemeral cache write
  cacheReadMultiplier: number;    // multiplier on inputPerM for cache read
};

const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-sonnet-4-6': { inputPerM: 3.0,  outputPerM: 15.0, cacheWriteMultiplier1h: 2.0, cacheReadMultiplier: 0.1 },
  'claude-haiku-4-5':  { inputPerM: 1.0,  outputPerM:  5.0, cacheWriteMultiplier1h: 2.0, cacheReadMultiplier: 0.1 },
};

function priceFor(model: string): ModelPrice {
  if (MODEL_PRICES[model]) return MODEL_PRICES[model] as ModelPrice;
  // Default to Sonnet pricing for unknown models — generous upper bound for cost reporting.
  return MODEL_PRICES['claude-sonnet-4-6'] as ModelPrice;
}

/** Returns the cost of one LLM call in micro-USD (integer). */
export function llmCallMicroUsd(usage: TokenUsage): number {
  const p = priceFor(usage.model);
  const inputUsd = (usage.inputTokens / 1_000_000) * p.inputPerM;
  const outputUsd = (usage.outputTokens / 1_000_000) * p.outputPerM;
  const cacheWriteUsd = (usage.cacheWriteTokens / 1_000_000) * p.inputPerM * p.cacheWriteMultiplier1h;
  const cacheReadUsd = (usage.cacheReadTokens / 1_000_000) * p.inputPerM * p.cacheReadMultiplier;
  return Math.round((inputUsd + outputUsd + cacheWriteUsd + cacheReadUsd) * 1_000_000);
}

/** Image cost helpers — Flux Schnell on fal.ai = $0.003/image as of May 2026. */
export const IMAGE_COST_MICRO_USD_PER_IMAGE = 3000;
export function imagesMicroUsd(n: number): number {
  return n * IMAGE_COST_MICRO_USD_PER_IMAGE;
}

export function microUsdToDisplay(microUsd: number): string {
  if (microUsd < 10_000) return `${(microUsd / 1000).toFixed(2)}m¢`;
  return `$${(microUsd / 1_000_000).toFixed(4)}`;
}
