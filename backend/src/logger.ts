import { pino } from 'pino';
import { env } from './env.ts';

export const logger = pino({
  level: env().LOG_LEVEL,
  base: { service: 'edumind-backend' },
  ...(env().NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: false } } }
    : {}),
});

export type LLMCallLog = {
  gameId?: string;
  studentId?: string;
  model: string;
  phase: 'spec' | 'code' | 'repair' | 'feedback' | 'normalize';
  latencyMs: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputTokens: number;
  outputTokens: number;
};

export function logLLMCall(payload: LLMCallLog): void {
  const cacheRatio =
    payload.cacheReadTokens > 0
      ? payload.cacheReadTokens / (payload.cacheReadTokens + payload.inputTokens)
      : 0;
  logger.info({ ...payload, cacheReadRatio: cacheRatio }, 'llm.call');
  if (cacheRatio > 0 && cacheRatio < 0.7) {
    logger.warn({ phase: payload.phase, cacheRatio }, 'cache.below_threshold');
  }
}
