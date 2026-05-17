import * as z from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().url(),

  EDUMIND_GENERATION_PROVIDER: z.enum(['anthropic']).default('anthropic'),
  EDUMIND_GENERATION_API_KEY: z.string().min(1, 'ANTHROPIC API key required'),
  EDUMIND_GENERATION_MODEL_PRIMARY: z.string().default('claude-sonnet-4-6'),
  EDUMIND_GENERATION_MODEL_FAST: z.string().default('claude-haiku-4-5'),
  EDUMIND_GENERATION_CACHE_TTL: z.enum(['5m', '1h']).default('1h'),

  EDUMIND_MODERATION_PROVIDER: z.enum(['openai']).default('openai'),
  EDUMIND_MODERATION_API_KEY: z.string().min(1, 'OpenAI API key required'),
  EDUMIND_MODERATION_MODEL: z.string().default('omni-moderation-latest'),

  PLAYABILITY_SAMPLE_RATE_PROD: z.coerce.number().min(0).max(1).default(0.2),
  PLAYWRIGHT_MAX_CONTEXTS: z.coerce.number().int().positive().default(4),
  RATE_LIMIT_PER_STUDENT_PER_DAY: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment:', z.treeifyError(parsed.error));
    process.exit(1);
  }
  cached = parsed.data;
  return cached;
}
