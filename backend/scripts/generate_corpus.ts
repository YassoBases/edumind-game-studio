// Corpus runner. Iterates through a list of (subject, topic, language, archetype, theme)
// tuples, runs the full pipeline against each, and writes:
//   - backend/corpus/<gameId>.html for every generated game (visual review)
//   - backend/corpus_report.md with per-game + aggregate stats
//
// Usage:
//   node --env-file=.env --import tsx scripts/generate_corpus.ts                 # all 100 rows
//   node --env-file=.env --import tsx scripts/generate_corpus.ts --limit 5       # first 5 rows
//   node --env-file=.env --import tsx scripts/generate_corpus.ts --concurrency 3 # parallel
//
// Requires the backend's normal env (DATABASE_URL, EDUMIND_*_API_KEY) to be present.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { logger } from '../src/logger.ts';
import { prisma } from '../src/db.ts';
import { createAnthropicProvider } from '../src/providers/anthropic.ts';
import { createOpenAIModerationProvider } from '../src/providers/openai.ts';
import { runGenerationPipeline } from '../src/pipeline/generate.ts';
import { GenerateRequest } from '../src/schemas/summary.ts';
import type { ArchetypeId, ThemeId } from '../src/schemas/archetypes.ts';

type Row = {
  subject: string;
  topic: string;
  language: 'en' | 'ar';
  archetype: ArchetypeId;
  theme: ThemeId;
  style: 'memory_match' | 'sorting_puzzle' | 'quick_reflexes' | 'build_something' | 'story_quest' | 'step_by_step';
};

// 100 sensible rows covering all 4 archetypes × 4 themes × varied subjects.
// Each archetype gets 25 rows (4 themes × 6.25 → mix of subjects).
const CORPUS: Row[] = [
  // ---- lane_racer × 4 themes (25 rows) ----
  { subject: 'Biology', topic: 'Photosynthesis', language: 'en', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Cellular respiration', language: 'en', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Periodic table groups', language: 'en', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Physics', topic: 'Newton\'s laws', language: 'en', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Order of operations', language: 'en', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'World capitals', language: 'en', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },
  { subject: 'History', topic: 'World War 2 timeline', language: 'en', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Human body systems', language: 'en', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },
  { subject: 'English', topic: 'Parts of speech', language: 'en', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Common ions', language: 'en', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Multiplication tables', language: 'en', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Prime numbers', language: 'en', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'European countries', language: 'en', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Plant parts', language: 'en', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'History', topic: 'Ancient civilizations', language: 'en', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Fractions', language: 'en', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Food chains', language: 'en', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'Continents and oceans', language: 'en', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'Physics', topic: 'States of matter', language: 'en', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Acids and bases', language: 'en', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'Arabic', topic: 'حروف الجر', language: 'ar', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Arabic', topic: 'الأفعال الخمسة', language: 'ar', archetype: 'lane_racer', theme: 'car_racing_f1', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'الكسور', language: 'ar', archetype: 'lane_racer', theme: 'motorbike', style: 'quick_reflexes' },
  { subject: 'Science', topic: 'دورة الماء', language: 'ar', archetype: 'lane_racer', theme: 'kart', style: 'quick_reflexes' },
  { subject: 'History', topic: 'الحضارة الإسلامية', language: 'ar', archetype: 'lane_racer', theme: 'car_racing_street', style: 'quick_reflexes' },

  // ---- goal_shootout × 4 themes (25 rows) ----
  { subject: 'Geography', topic: 'Capital cities of Asia', language: 'en', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'Capital cities of Africa', language: 'en', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Vertebrates vs invertebrates', language: 'en', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Element symbols', language: 'en', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'History', topic: 'US presidents', language: 'en', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Square roots', language: 'en', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'Physics', topic: 'Force formulas', language: 'en', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'English', topic: 'Synonyms', language: 'en', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Cell organelles', language: 'en', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Common compounds', language: 'en', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Solving for x', language: 'en', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'Major rivers', language: 'en', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'DNA basics', language: 'en', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'History', topic: 'World leaders timeline', language: 'en', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'Physics', topic: 'Energy types', language: 'en', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'Geometry shapes', language: 'en', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },
  { subject: 'English', topic: 'Antonyms', language: 'en', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'Animal kingdoms', language: 'en', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },
  { subject: 'Chemistry', topic: 'Acid/base indicators', language: 'en', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },
  { subject: 'History', topic: 'Renaissance figures', language: 'en', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },
  { subject: 'Geography', topic: 'عواصم الدول العربية', language: 'ar', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Math', topic: 'جدول الضرب', language: 'ar', archetype: 'goal_shootout', theme: 'football', style: 'quick_reflexes' },
  { subject: 'Biology', topic: 'أجهزة الجسم', language: 'ar', archetype: 'goal_shootout', theme: 'basketball', style: 'quick_reflexes' },
  { subject: 'Arabic', topic: 'المفعول به والمفعول فيه', language: 'ar', archetype: 'goal_shootout', theme: 'hockey', style: 'quick_reflexes' },
  { subject: 'Science', topic: 'المركبات الكيميائية', language: 'ar', archetype: 'goal_shootout', theme: 'archery', style: 'quick_reflexes' },

  // ---- tower_builder × 4 themes (25 rows) ----
  { subject: 'Chemistry', topic: 'Building simple molecules', language: 'en', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'Math', topic: 'Place value', language: 'en', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'English', topic: 'Sentence structure', language: 'en', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'Biology', topic: 'Food pyramid', language: 'en', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'History', topic: 'Building a Roman aqueduct', language: 'en', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'Physics', topic: 'Rocket equation parts', language: 'en', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Astronomy', topic: 'Solar system order', language: 'en', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Chemistry', topic: 'Atomic structure', language: 'en', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Math', topic: 'Order of operations', language: 'en', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Science', topic: 'Rocket fuel components', language: 'en', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Math', topic: 'Decimal place values', language: 'en', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'English', topic: 'Compound words', language: 'en', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'Biology', topic: 'DNA base pairs', language: 'en', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'Chemistry', topic: 'Naming acids', language: 'en', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'Physics', topic: 'Circuit building', language: 'en', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'Biology', topic: 'Forest layers', language: 'en', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'Geography', topic: 'Mountain formation', language: 'en', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'English', topic: 'Story arc parts', language: 'en', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'Math', topic: 'Geometric shapes', language: 'en', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'Chemistry', topic: 'Carbohydrates', language: 'en', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'Chemistry', topic: 'بناء جزيء الماء', language: 'ar', archetype: 'tower_builder', theme: 'castle', style: 'build_something' },
  { subject: 'Math', topic: 'بناء الأعداد', language: 'ar', archetype: 'tower_builder', theme: 'rocket', style: 'build_something' },
  { subject: 'Biology', topic: 'بناء السلسلة الغذائية', language: 'ar', archetype: 'tower_builder', theme: 'treehouse', style: 'build_something' },
  { subject: 'Arabic', topic: 'بناء الجملة الاسمية', language: 'ar', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },
  { subject: 'Physics', topic: 'بناء دارة كهربائية', language: 'ar', archetype: 'tower_builder', theme: 'skyscraper', style: 'build_something' },

  // ---- quest_path × 4 themes (25 rows) ----
  { subject: 'Math', topic: 'Solving linear equations', language: 'en', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Math', topic: 'Quadratic equations', language: 'en', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Physics', topic: 'Projectile motion', language: 'en', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Biology', topic: 'Mitosis phases', language: 'en', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Chemistry', topic: 'Balancing chemical equations', language: 'en', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Physics', topic: 'Conservation of momentum', language: 'en', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'Astronomy', topic: 'Kepler\'s laws', language: 'en', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'Math', topic: 'Geometric proofs', language: 'en', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'Chemistry', topic: 'Reaction rates', language: 'en', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'Biology', topic: 'Genetic inheritance', language: 'en', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'History', topic: 'French Revolution causes', language: 'en', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'English', topic: 'Detective story analysis', language: 'en', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'Math', topic: 'Probability puzzles', language: 'en', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'Geography', topic: 'Climate patterns', language: 'en', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'Biology', topic: 'Forensic science basics', language: 'en', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'Math', topic: 'Working with percentages', language: 'en', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
  { subject: 'English', topic: 'Poetic devices', language: 'en', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
  { subject: 'History', topic: 'Edo period Japan', language: 'en', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
  { subject: 'Biology', topic: 'Ecosystems', language: 'en', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
  { subject: 'Physics', topic: 'Optics basics', language: 'en', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
  { subject: 'Math', topic: 'حل المعادلات الخطية', language: 'ar', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Biology', topic: 'مراحل الانقسام الخلوي', language: 'ar', archetype: 'quest_path', theme: 'fantasy', style: 'story_quest' },
  { subject: 'Chemistry', topic: 'موازنة المعادلات', language: 'ar', archetype: 'quest_path', theme: 'sci_fi', style: 'story_quest' },
  { subject: 'History', topic: 'الحروب الصليبية', language: 'ar', archetype: 'quest_path', theme: 'detective', style: 'story_quest' },
  { subject: 'Arabic', topic: 'الإعراب', language: 'ar', archetype: 'quest_path', theme: 'anime', style: 'story_quest' },
];

type Result = {
  row: Row;
  gameId?: string;
  durationMs: number;
  totalCostMicroUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  htmlSize?: number;
  validatorFailures: string[]; // signatures
  repairAttempts: number;
  playabilityErrors: string[];
  error?: string;
};

function parseArgs(): { limit: number; concurrency: number } {
  const args = process.argv.slice(2);
  let limit = CORPUS.length;
  let concurrency = 1;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--limit') limit = Math.max(1, Number(args[++i] ?? '0')) || limit;
    else if (args[i] === '--concurrency') concurrency = Math.max(1, Number(args[++i] ?? '0')) || concurrency;
  }
  return { limit, concurrency };
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? 0) : (((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2);
}
function percentile(nums: number[], p: number): number {
  if (nums.length === 0) return 0;
  const s = nums.slice().sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor(p * s.length));
  return s[idx] ?? 0;
}

async function runOne(row: Row, providers: { generation: ReturnType<typeof createAnthropicProvider>; moderation: ReturnType<typeof createOpenAIModerationProvider> }, corpusDir: string): Promise<Result> {
  const t0 = performance.now();
  const result: Result = {
    row,
    durationMs: 0,
    totalCostMicroUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    validatorFailures: [],
    repairAttempts: 0,
    playabilityErrors: [],
  };
  try {
    const req = GenerateRequest.parse({
      studentId: 'corpus-runner',
      language: row.language,
      subject: row.subject,
      topic: row.topic,
      style: row.style,
      theme: row.theme,
      idempotencyKey: `corpus:${row.archetype}:${row.theme}:${row.subject}:${row.topic}`,
    });
    const out = await runGenerationPipeline(
      {
        req,
        normalized: {
          subject: row.subject,
          topic: row.topic,
          archetype: row.archetype,
          theme: row.theme,
          language: row.language,
          studentInterests: [],
          confidence: 1,
          clarifyingQuestion: null,
          safetyFlags: [],
        },
        onStage: (e) => {
          if (e.stage === 'repair' && e.status === 'start') result.repairAttempts += 1;
        },
      },
      providers,
    );
    result.durationMs = performance.now() - t0;
    result.totalCostMicroUsd = out.totalCostMicroUsd;
    result.inputTokens = out.totalUsage.inputTokens;
    result.outputTokens = out.totalUsage.outputTokens;
    result.cacheReadTokens = out.totalUsage.cacheReadTokens;
    result.cacheWriteTokens = out.totalUsage.cacheWriteTokens;
    result.htmlSize = out.html.length;
    result.validatorFailures = out.validatorResults.filter((v) => !v.ok).map((v) => v.signature);
    result.playabilityErrors = out.playabilityErrors;
    // Persist game row to Postgres so it's reachable via /play, AND write HTML to disk.
    const game = await prisma.game.create({
      data: {
        studentId: (await prisma.student.upsert({
          where: { externalId: 'corpus-runner' },
          update: {},
          create: { externalId: 'corpus-runner', language: row.language },
        })).id,
        templateId: out.templateId,
        archetype: out.archetype,
        themeId: out.themeId,
        language: out.spec.language,
        orientation: out.spec.orientation,
        subject: out.spec.subject,
        topic: out.spec.topic,
        spec: out.spec as unknown as object,
        html: out.html,
        model: out.totalUsage.model,
        inputTokens: out.totalUsage.inputTokens,
        outputTokens: out.totalUsage.outputTokens,
        cacheReadTokens: out.totalUsage.cacheReadTokens,
        cacheWriteTokens: out.totalUsage.cacheWriteTokens,
        imageCostUsdMillicents: out.imageCostMillicents,
      },
    });
    result.gameId = game.id;
    await writeFile(join(corpusDir, `${game.id}.html`), out.html, 'utf8');
    logger.info(
      { gameId: game.id, ms: Math.round(result.durationMs), cost: (result.totalCostMicroUsd / 1000).toFixed(2) + 'm¢' },
      'corpus.row_done',
    );
  } catch (err) {
    result.durationMs = performance.now() - t0;
    result.error = err instanceof Error ? err.message : String(err);
    logger.error({ row: `${row.archetype}/${row.theme}/${row.topic}`, err: result.error }, 'corpus.row_failed');
  }
  return result;
}

async function main() {
  const { limit, concurrency } = parseArgs();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const corpusDir = join(__dirname, '..', 'corpus');
  await mkdir(corpusDir, { recursive: true });

  const generation = createAnthropicProvider();
  const moderation = createOpenAIModerationProvider();

  const rows = CORPUS.slice(0, limit);
  logger.info({ rows: rows.length, concurrency }, 'corpus.start');

  const results: Result[] = [];
  // Concurrency-limited fanout using a worker queue
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (cursor < rows.length) {
        const i = cursor++;
        const row = rows[i];
        if (!row) continue;
        const r = await runOne(row, { generation, moderation }, corpusDir);
        results.push(r);
        logger.info({ done: results.length, total: rows.length }, 'corpus.progress');
      }
    }),
  );

  // ===== Aggregate =====
  const ok = results.filter((r) => !r.error);
  const firstTryPasses = results.filter((r) => !r.error && r.repairAttempts === 0).length;
  const durationsMs = ok.map((r) => r.durationMs);
  const costsMicroUsd = ok.map((r) => r.totalCostMicroUsd);

  const signatureFreq = new Map<string, number>();
  for (const r of results) {
    for (const sig of r.validatorFailures) signatureFreq.set(sig, (signatureFreq.get(sig) || 0) + 1);
  }
  const topSignatures = Array.from(signatureFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

  // ===== Write markdown report =====
  const lines: string[] = [];
  lines.push('# Corpus generation report');
  lines.push('');
  lines.push(`**Rows attempted:** ${results.length}`);
  lines.push(`**Successes:** ${ok.length}`);
  lines.push(`**Failures:** ${results.length - ok.length}`);
  lines.push(`**First-try pass rate (zero repairs):** ${ok.length === 0 ? '—' : ((firstTryPasses / ok.length) * 100).toFixed(1) + '%'}`);
  lines.push('');
  lines.push('## Aggregate stats');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| p50 latency | ${(median(durationsMs) / 1000).toFixed(1)} s |`);
  lines.push(`| p95 latency | ${(percentile(durationsMs, 0.95) / 1000).toFixed(1)} s |`);
  lines.push(`| avg cost | $${(ok.reduce((s, r) => s + r.totalCostMicroUsd, 0) / Math.max(1, ok.length) / 1_000_000).toFixed(4)} |`);
  lines.push(`| p50 cost | $${(median(costsMicroUsd) / 1_000_000).toFixed(4)} |`);
  lines.push(`| p95 cost | $${(percentile(costsMicroUsd, 0.95) / 1_000_000).toFixed(4)} |`);
  lines.push(`| avg HTML size | ${Math.round(ok.reduce((s, r) => s + (r.htmlSize ?? 0), 0) / Math.max(1, ok.length))} bytes |`);
  lines.push('');
  lines.push('## Top 10 validator/repair signatures by frequency');
  lines.push('');
  lines.push('| Signature | Count |');
  lines.push('|---|---|');
  for (const [sig, n] of topSignatures) lines.push(`| \`${sig}\` | ${n} |`);
  lines.push('');
  lines.push('## Per-row results');
  lines.push('');
  lines.push('| # | Archetype/Theme | Topic | Lang | Time | Cost | Repairs | Failures | Game |');
  lines.push('|---|---|---|---|---|---|---|---|---|');
  results.forEach((r, i) => {
    const sec = (r.durationMs / 1000).toFixed(1);
    const cost = (r.totalCostMicroUsd / 1_000_000).toFixed(4);
    const fails = r.validatorFailures.length === 0 ? '—' : r.validatorFailures.length.toString();
    const idCell = r.gameId ? `[\`${r.gameId.slice(0, 12)}\`](corpus/${r.gameId}.html)` : (r.error ? '⚠ ' + r.error.slice(0, 40) : '—');
    lines.push(`| ${i + 1} | ${r.row.archetype}/${r.row.theme} | ${r.row.topic} | ${r.row.language} | ${sec} s | $${cost} | ${r.repairAttempts} | ${fails} | ${idCell} |`);
  });

  const reportPath = join(__dirname, '..', 'corpus_report.md');
  await writeFile(reportPath, lines.join('\n'), 'utf8');
  logger.info({ report: reportPath, htmlDir: corpusDir }, 'corpus.done');
  // Disconnect Prisma so the process exits cleanly
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.fatal({ err }, 'corpus.fatal');
  process.exit(1);
});
