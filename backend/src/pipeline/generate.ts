import { logger } from '../logger.ts';
import type { GenerateRequest } from '../schemas/summary.ts';
import type { GameSpec, TemplateId } from '../schemas/gameSpec.ts';
import {
  ARCHETYPE_TO_TEMPLATE,
  DEFAULT_THEMES,
  TEMPLATE_TO_DEFAULT_ARCHETYPE,
  type ArchetypeId,
  type ThemeId,
} from '../schemas/archetypes.ts';
import type { NormalizedRequest } from '../schemas/normalizer.ts';
import type { GenerationProvider, ModerationProvider, TokenUsage } from '../providers/types.ts';
import { loadTemplate } from './templates.ts';
import { wrapInScaffold } from './scaffold.ts';
import { runValidators, type ValidatorResult } from './validators.ts';
import {
  applyAutoPatch,
  findEntry,
  recordOccurrence,
  addEntry,
  type RepairEntry,
} from './repairProtocol.ts';
import { runPlayabilityCheck, shouldRunPlayability } from './playwrightCheck.ts';
import { composeSprites, type SpriteManifest } from '../sprites/compose.ts';
import { llmCallMicroUsd, imagesMicroUsd } from '../pricing.ts';

export type PipelineStage =
  | 'moderation_pre'
  | 'spec'
  | 'sprites'
  | 'code'
  | 'validators'
  | 'repair'
  | 'playability'
  | 'moderation_post'
  | 'persist'
  | 'done';

export type StageEvent = {
  stage: PipelineStage;
  label: string;
  status: 'start' | 'end';
  latencyMs?: number;
  costMicroUsd: number;            // running total
  detail?: Record<string, unknown>;
};

export type StageEmitter = (e: StageEvent) => void;

const STYLE_TO_TEMPLATE: Record<GenerateRequest['style'], TemplateId> = {
  memory_match: 'match_pairs',
  sorting_puzzle: 'sort_categorize',
  quick_reflexes: 'target_practice',
  build_something: 'build_combine',
  story_quest: 'quiz_quest',
  step_by_step: 'sequence',
};

// Archetype IDs match a 1:1 backend template file (templates/<archetype>.html).
const ARCHETYPE_TEMPLATE_FILE = new Set(['lane_racer', 'goal_shootout', 'tower_builder', 'quest_path']);

export type GenerationOutput = {
  spec: GameSpec;
  html: string;
  innerScript: string;
  templateId: TemplateId;
  archetype: ArchetypeId | null;
  themeId: ThemeId | null;
  totalUsage: TokenUsage;
  validatorResults: ValidatorResult[];
  playabilityErrors: string[];
  spriteManifest: SpriteManifest;
  imageCostMillicents: number;
  totalCostMicroUsd: number;
};

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    model: b.model || a.model,
  };
}
const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  model: '',
};
const EMPTY_MANIFEST: SpriteManifest = { library: {}, generated: {} };

function detectLanguageFromFreeText(text: string): 'en' | 'ar' {
  return /[؀-ۿ]/.test(text) ? 'ar' : 'en';
}

async function repair(
  provider: GenerationProvider,
  html: string,
  failures: ValidatorResult[],
): Promise<{ html: string; usage: TokenUsage }> {
  let current = html;
  let usage = ZERO_USAGE;

  for (const f of failures) {
    const entry = await findEntry(f.signature);
    if (entry?.auto_patch) {
      current = applyAutoPatch(current, entry.auto_patch);
      await recordOccurrence(entry.signature);
      logger.info({ signature: entry.signature }, 'repair.auto_patch_applied');
    }
  }

  const remaining: string[] = [];
  for (const f of failures) {
    const entry = await findEntry(f.signature);
    if (entry && !entry.auto_patch) {
      remaining.push(
        `SIGNATURE: ${f.signature}\nROOT CAUSE: ${entry.root_cause}\nFIX: ${entry.fix_template}\nDETAIL: ${f.detail}`,
      );
      await recordOccurrence(entry.signature);
    } else if (!entry) {
      remaining.push(`SIGNATURE: ${f.signature}\nUNKNOWN — diagnose and fix.\nDETAIL: ${f.detail}`);
    }
  }
  if (remaining.length > 0) {
    const instruction = remaining.join('\n\n---\n\n');
    const res = await provider.generateRepair(current, instruction, true);
    current = res.html;
    usage = addUsage(usage, res.usage);

    for (const f of failures) {
      const entry = await findEntry(f.signature);
      if (!entry) {
        const newEntry: RepairEntry = {
          signature: f.signature,
          occurrences: 1,
          last_seen: new Date().toISOString(),
          root_cause: `Auto-captured: ${f.detail}`,
          fix_template: instruction,
          verified: false,
        };
        await addEntry(newEntry);
        logger.info({ signature: f.signature }, 'repair.new_protocol_entry');
      }
    }
  }

  return { html: current, usage };
}

/**
 * Resolve the (templateId, archetype, themeId) triple from inputs. Two paths:
 *  - normalized path: archetype + theme already chosen by the normalizer
 *  - legacy path: style → templateId, archetype optional via TEMPLATE_TO_DEFAULT_ARCHETYPE
 */
function resolveArchetype(
  req: GenerateRequest,
  normalized?: NormalizedRequest,
): { templateId: TemplateId; archetype: ArchetypeId | null; themeId: ThemeId | null; templateFile: string } {
  if (normalized) {
    const templateId = ARCHETYPE_TO_TEMPLATE[normalized.archetype];
    return {
      templateId,
      archetype: normalized.archetype,
      themeId: normalized.theme,
      templateFile: normalized.archetype, // archetype HTML file
    };
  }
  const templateId = STYLE_TO_TEMPLATE[req.style];
  const archetype = TEMPLATE_TO_DEFAULT_ARCHETYPE[templateId] ?? null;
  if (archetype && ARCHETYPE_TEMPLATE_FILE.has(archetype)) {
    return { templateId, archetype, themeId: DEFAULT_THEMES[archetype], templateFile: archetype };
  }
  return { templateId, archetype: null, themeId: null, templateFile: templateId };
}

export type PipelineInput = {
  req: GenerateRequest;
  normalized?: NormalizedRequest;
  onStage?: StageEmitter;
};

export async function runGenerationPipeline(
  input: PipelineInput,
  providers: { generation: GenerationProvider; moderation: ModerationProvider },
): Promise<GenerationOutput> {
  const { req, normalized } = input;
  const emit = input.onStage ?? (() => {});
  let totalUsage = ZERO_USAGE;
  let runningCostMicroUsd = 0;
  function emitStart(stage: PipelineStage, label: string, detail?: Record<string, unknown>) {
    emit({ stage, label, status: 'start', costMicroUsd: runningCostMicroUsd, ...(detail ? { detail } : {}) });
    return Date.now();
  }
  function emitEnd(stage: PipelineStage, label: string, t0: number, detail?: Record<string, unknown>) {
    emit({
      stage,
      label,
      status: 'end',
      latencyMs: Date.now() - t0,
      costMicroUsd: runningCostMicroUsd,
      ...(detail ? { detail } : {}),
    });
  }

  const detectedLang = detectLanguageFromFreeText(`${req.topic} ${req.subject} ${req.extra ?? ''}`);
  const language: 'en' | 'ar' = normalized?.language ?? (detectedLang === 'ar' ? 'ar' : req.language);

  const preText = [req.subject, req.topic, req.theme ?? '', req.extra ?? ''].join('\n');
  const tMod = emitStart('moderation_pre', 'Safety check');
  const preCheck = await providers.moderation.check(preText, language);
  emitEnd('moderation_pre', 'Safety check', tMod);
  if (!preCheck.safe) {
    throw Object.assign(new Error('Content rejected by moderation'), {
      statusCode: 400,
      categories: preCheck.categories,
    });
  }

  const { templateId, archetype, themeId, templateFile } = resolveArchetype(req, normalized);

  const tSpec = emitStart('spec', 'Designing the game');
  const specRes = await providers.generation.generateSpec({
    language,
    subject: req.subject,
    topic: req.topic,
    style: req.style,
    theme: req.theme,
    extra: req.extra,
  });
  totalUsage = addUsage(totalUsage, specRes.usage);
  runningCostMicroUsd += llmCallMicroUsd(specRes.usage);
  emitEnd('spec', 'Designing the game', tSpec, { tokens: specRes.usage });
  const spec: GameSpec = {
    ...specRes.spec,
    templateId,
    language,
    ...(archetype ? { archetype } : {}),
    ...(themeId ? { themeId } : {}),
  };

  // Compose sprites IN PARALLEL with code generation. Both have explicit progress events.
  const templateHtml = await loadTemplate(templateFile as TemplateId);
  const tSprites = emitStart('sprites', 'Designing the visuals');
  const spriteP = archetype && themeId
    ? composeSprites(spec, archetype, themeId).then((r) => {
        runningCostMicroUsd += imagesMicroUsd(Object.keys(r.manifest.generated).length);
        emitEnd('sprites', 'Designing the visuals', tSprites, {
          libraryCount: Object.keys(r.manifest.library).length,
          generatedCount: Object.keys(r.manifest.generated).length,
        });
        return r;
      })
    : Promise.resolve({ manifest: EMPTY_MANIFEST, costMillicents: 0, provider: 'disabled' }).then((r) => {
        emitEnd('sprites', 'Designing the visuals', tSprites, { libraryCount: 0, generatedCount: 0 });
        return r;
      });
  const tCode = emitStart('code', 'Writing the game code');
  const codeP = providers.generation.generateCode(spec, templateHtml).then((r) => {
    totalUsage = addUsage(totalUsage, r.usage);
    runningCostMicroUsd += llmCallMicroUsd(r.usage);
    emitEnd('code', 'Writing the game code', tCode, { tokens: r.usage });
    return r;
  });
  const [spriteResult, codeRes] = await Promise.all([spriteP, codeP]);

  let innerScript = codeRes.innerScript;
  let html = await wrapInScaffold({ language, innerScript, sprites: spriteResult.manifest });

  const tValid = emitStart('validators', 'Checking quality');
  let validatorResults = runValidators({
    html,
    innerScript,
    spec,
    spriteManifest: spriteResult.manifest,
  });
  let failures = validatorResults.filter((r) => !r.ok);
  emitEnd('validators', 'Checking quality', tValid, { failures: failures.map((f) => f.signature) });

  let repairAttempts = 0;
  while (failures.length > 0 && repairAttempts < 2) {
    repairAttempts += 1;
    const tRepair = emitStart('repair', `Fixing issues (try ${repairAttempts})`, {
      signatures: failures.map((f) => f.signature),
    });
    logger.info({ attempt: repairAttempts, failures: failures.map((f) => f.signature) }, 'repair.attempt');
    const r = await repair(providers.generation, html, failures);
    html = r.html;
    totalUsage = addUsage(totalUsage, r.usage);
    runningCostMicroUsd += llmCallMicroUsd(r.usage);
    innerScript = extractInnerScript(html) ?? innerScript;
    validatorResults = runValidators({
      html,
      innerScript,
      spec,
      spriteManifest: spriteResult.manifest,
    });
    failures = validatorResults.filter((r2) => !r2.ok);
    emitEnd('repair', `Fixing issues (try ${repairAttempts})`, tRepair, {
      remaining: failures.map((f) => f.signature),
    });
  }

  // Parallelize playability + post-moderation — both are ~0.5-5s, both read-only against
  // the assembled HTML and the spec content. They were sequential before.
  const playabilityErrors: string[] = [];
  const renderedSample = spec.levels
    .flatMap((l) => l.contentItems.flatMap((it) => [it.prompt, it.explanationOnWrong]))
    .slice(0, 50)
    .join('\n');
  const tPlay = emitStart('playability', 'Test-driving the game');
  const tPostMod = emitStart('moderation_post', 'Final safety check');
  const playP = shouldRunPlayability()
    ? runPlayabilityCheck(html, language).then((r) => {
        emitEnd('playability', 'Test-driving the game', tPlay, { ok: r.ok });
        return r;
      })
    : Promise.resolve({ ok: true, signature: 'skipped', errors: [] as string[], warnings: [] as string[] }).then((r) => {
        emitEnd('playability', 'Test-driving the game', tPlay, { skipped: true });
        return r;
      });
  const postModP = providers.moderation.check(renderedSample, language).then((r) => {
    emitEnd('moderation_post', 'Final safety check', tPostMod);
    return r;
  });
  const [play, postCheck] = await Promise.all([playP, postModP]);
  if (!postCheck.safe) {
    throw Object.assign(new Error('Generated content failed moderation'), {
      statusCode: 422,
      categories: postCheck.categories,
    });
  }
  if (!play.ok) {
    logger.warn({ errors: play.errors }, 'playability.failed');
    const repairRes = await providers.generation.generateRepair(
      html,
      `Playwright runtime errors:\n${play.errors.join('\n')}\nFix without changing scenes or removing EduCore.`,
      true,
    );
    html = repairRes.html;
    totalUsage = addUsage(totalUsage, repairRes.usage);
    runningCostMicroUsd += llmCallMicroUsd(repairRes.usage);
    innerScript = extractInnerScript(html) ?? innerScript;
    const re = await runPlayabilityCheck(html, language);
    if (!re.ok) playabilityErrors.push(...re.errors);
  }

  emit({ stage: 'done', label: 'Ready', status: 'end', costMicroUsd: runningCostMicroUsd });
  return {
    spec,
    html,
    innerScript,
    templateId,
    archetype,
    themeId,
    totalUsage,
    validatorResults,
    playabilityErrors,
    spriteManifest: spriteResult.manifest,
    imageCostMillicents: spriteResult.costMillicents,
    totalCostMicroUsd: runningCostMicroUsd,
  };
}

function extractInnerScript(html: string): string | null {
  const scripts = Array.from(html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g));
  if (scripts.length === 0) return null;
  const last = scripts[scripts.length - 1];
  return last?.[1] ?? null;
}
