import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as z from 'zod';
import { prisma } from '../db.ts';
import { logger } from '../logger.ts';
import { GenerateRequest, LevelReport, Summary } from '../schemas/summary.ts';
import { RawComposeRequest, type NormalizedRequest } from '../schemas/normalizer.ts';
import { ARCHETYPE_TO_TEMPLATE } from '../schemas/archetypes.ts';
import { runGenerationPipeline } from '../pipeline/generate.ts';
import { createAnthropicProvider } from '../providers/anthropic.ts';
import { createOpenAIModerationProvider } from '../providers/openai.ts';

const generation = createAnthropicProvider();
const moderation = createOpenAIModerationProvider();

// In-memory idempotency cache (24h TTL). Production swap: Redis.
const idempotencyCache = new Map<string, { gameId: string; expiresAt: number }>();
const IDEMP_TTL_MS = 24 * 60 * 60 * 1000;

function getStudentId(req: FastifyRequest): string {
  const id = req.headers['x-student-id'];
  if (typeof id !== 'string' || !id) {
    throw Object.assign(new Error('Missing x-student-id header'), { statusCode: 401 });
  }
  return id;
}

async function ensureStudent(studentId: string, language: 'en' | 'ar') {
  return prisma.student.upsert({
    where: { externalId: studentId },
    update: { language },
    create: { externalId: studentId, language },
  });
}

const RefineBody = z.object({
  instruction: z.string().min(3).max(400),
});

const ComposeBody = z.object({
  rawPrompt: z.string().min(2).max(400),
  language: z.enum(['en', 'ar']).default('en'),
  // Multi-step preferences captured by the composer before generation. These get folded into
  // the `extra` field on the GenerateRequest so the spec generator can use them as hints.
  preferences: z
    .object({
      difficulty: z.enum(['easy', 'medium', 'hard', 'challenge']).optional(),
      sessionLength: z.enum(['quick', 'standard', 'long']).optional(),
      focusArea: z.string().max(80).optional(),
      grade: z.number().int().min(7).max(12).optional(),
    })
    .optional(),
});

const NORMALIZED_STYLE_BY_ARCHETYPE = {
  lane_racer: 'quick_reflexes',
  goal_shootout: 'quick_reflexes',
  tower_builder: 'build_something',
  quest_path: 'story_quest',
} as const;

export async function gamesRoutes(app: FastifyInstance): Promise<void> {
  app.post('/generate', async (req, reply) => {
    const studentId = getStudentId(req);
    const body = GenerateRequest.parse({
      ...((req.body as object) ?? {}),
      studentId,
      idempotencyKey:
        (req.headers['idempotency-key'] as string | undefined) ??
        `${studentId}:${Date.now()}`,
    });

    const cached = idempotencyCache.get(body.idempotencyKey);
    if (cached && cached.expiresAt > Date.now()) {
      const existing = await prisma.game.findUnique({ where: { id: cached.gameId } });
      if (existing) {
        return reply.send({
          gameId: existing.id,
          orientation: existing.orientation,
          language: existing.language,
          html: existing.html,
          cached: true,
        });
      }
    }

    const student = await ensureStudent(studentId, body.language);
    const result = await runGenerationPipeline({ req: body }, { generation, moderation });

    const game = await prisma.game.create({
      data: {
        studentId: student.id,
        templateId: result.templateId,
        archetype: result.archetype,
        themeId: result.themeId,
        language: result.spec.language,
        orientation: result.spec.orientation,
        subject: result.spec.subject,
        topic: result.spec.topic,
        spec: result.spec as unknown as object,
        html: result.html,
        model: result.totalUsage.model,
        inputTokens: result.totalUsage.inputTokens,
        outputTokens: result.totalUsage.outputTokens,
        cacheReadTokens: result.totalUsage.cacheReadTokens,
        cacheWriteTokens: result.totalUsage.cacheWriteTokens,
        imageCostUsdMillicents: result.imageCostMillicents,
      },
    });

    idempotencyCache.set(body.idempotencyKey, {
      gameId: game.id,
      expiresAt: Date.now() + IDEMP_TTL_MS,
    });

    return reply.send({
      gameId: game.id,
      orientation: game.orientation,
      language: game.language,
      html: game.html,
    });
  });

  // Compose-stream: SSE endpoint that emits per-stage progress + running cost, ending with
  // the final gameId + html. Used by the dashboard's progress bar.
  app.post('/compose-stream', async (req, reply) => {
    const studentId = getStudentId(req);
    const body = ComposeBody.parse(req.body ?? {});

    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'x-accel-buffering': 'no',
    });
    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    // Heartbeat — many proxies will close streams that go silent for ~60s.
    const heartbeat = setInterval(() => {
      try { reply.raw.write(': keepalive\n\n'); } catch { /* ignore */ }
    }, 15_000);

    try {
      send('open', { startedAt: new Date().toISOString() });
      const tNorm = Date.now();
      const { normalized, usage: normUsage } = await generation.normalize(body.rawPrompt, body.language);
      send('stage', {
        stage: 'normalize',
        label: 'Reading your prompt',
        status: 'end',
        latencyMs: Date.now() - tNorm,
        costMicroUsd: ((normUsage.inputTokens + normUsage.cacheWriteTokens) / 1_000_000) * 1.0 * 1e6 +
                      (normUsage.outputTokens / 1_000_000) * 5.0 * 1e6,
        detail: { archetype: normalized.archetype, theme: normalized.theme, confidence: normalized.confidence },
      });
      if (normalized.safetyFlags.length > 0) {
        send('error', { reason: 'safety_flagged', flags: normalized.safetyFlags });
        reply.raw.end();
        return;
      }
      if (normalized.confidence < 0.6) {
        send('clarify', {
          clarifyingQuestion: normalized.clarifyingQuestion,
          suggestedArchetype: normalized.archetype,
          suggestedTheme: normalized.theme,
          normalized,
        });
        reply.raw.end();
        return;
      }

      const prefs = body.preferences ?? {};
      const extraBits = [
        prefs.difficulty ? `difficulty:${prefs.difficulty}` : null,
        prefs.sessionLength ? `length:${prefs.sessionLength}` : null,
        prefs.focusArea ? `focus:${prefs.focusArea}` : null,
        prefs.grade ? `grade:${prefs.grade}` : null,
      ].filter(Boolean).join(', ');
      const generateReq = GenerateRequest.parse({
        studentId,
        language: normalized.language,
        subject: normalized.subject,
        topic: normalized.topic,
        style: NORMALIZED_STYLE_BY_ARCHETYPE[normalized.archetype],
        theme: normalized.theme,
        ...(extraBits ? { extra: extraBits } : {}),
        idempotencyKey: `${studentId}:${Date.now()}`,
      });
      const student = await ensureStudent(studentId, normalized.language);
      const result = await runGenerationPipeline(
        {
          req: generateReq,
          normalized,
          onStage: (e) => send('stage', e),
        },
        { generation, moderation },
      );

      const game = await prisma.game.create({
        data: {
          studentId: student.id,
          templateId: result.templateId,
          archetype: result.archetype,
          themeId: result.themeId,
          language: result.spec.language,
          orientation: result.spec.orientation,
          subject: result.spec.subject,
          topic: result.spec.topic,
          spec: result.spec as unknown as object,
          html: result.html,
          model: result.totalUsage.model,
          inputTokens: result.totalUsage.inputTokens,
          outputTokens: result.totalUsage.outputTokens,
          cacheReadTokens: result.totalUsage.cacheReadTokens,
          cacheWriteTokens: result.totalUsage.cacheWriteTokens,
          imageCostUsdMillicents: result.imageCostMillicents,
        },
      });

      send('done', {
        gameId: game.id,
        orientation: game.orientation,
        language: game.language,
        html: game.html,
        totalCostMicroUsd: result.totalCostMicroUsd,
        normalized,
      });
    } catch (err) {
      logger.error({ err }, 'compose-stream.error');
      send('error', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      clearInterval(heartbeat);
      reply.raw.end();
    }
  });

  // Compose route: raw student prompt → normalizer → either clarify or run pipeline.
  app.post('/compose', async (req, reply) => {
    const studentId = getStudentId(req);
    const body = ComposeBody.parse(req.body ?? {});
    const { normalized, usage } = await generation.normalize(body.rawPrompt, body.language);
    logger.info(
      { confidence: normalized.confidence, archetype: normalized.archetype, theme: normalized.theme },
      'compose.normalized',
    );
    if (normalized.safetyFlags.length > 0) {
      return reply.status(400).send({
        error: 'safety_flagged',
        flags: normalized.safetyFlags,
        clarifyingQuestion: normalized.clarifyingQuestion,
      });
    }
    if (normalized.confidence < 0.6) {
      return reply.send({
        needsClarification: true,
        clarifyingQuestion:
          normalized.clarifyingQuestion ??
          (normalized.language === 'ar' ? 'هل يمكنك توضيح ما تريد تعلمه؟' : 'Could you clarify what you want to learn?'),
        suggestedArchetype: normalized.archetype,
        suggestedTheme: normalized.theme,
        normalized,
      });
    }
    // Build a GenerateRequest from the normalized fields and run the pipeline.
    const idempotencyKey =
      (req.headers['idempotency-key'] as string | undefined) ?? `${studentId}:${Date.now()}`;
    const generateReq = GenerateRequest.parse({
      studentId,
      language: normalized.language,
      subject: normalized.subject,
      topic: normalized.topic,
      style: NORMALIZED_STYLE_BY_ARCHETYPE[normalized.archetype],
      theme: normalized.theme,
      idempotencyKey,
    });
    const student = await ensureStudent(studentId, normalized.language);
    const result = await runGenerationPipeline(
      { req: generateReq, normalized },
      { generation, moderation },
    );
    const game = await prisma.game.create({
      data: {
        studentId: student.id,
        templateId: result.templateId,
        archetype: result.archetype,
        themeId: result.themeId,
        language: result.spec.language,
        orientation: result.spec.orientation,
        subject: result.spec.subject,
        topic: result.spec.topic,
        spec: result.spec as unknown as object,
        html: result.html,
        model: result.totalUsage.model,
        inputTokens: result.totalUsage.inputTokens + usage.inputTokens,
        outputTokens: result.totalUsage.outputTokens + usage.outputTokens,
        cacheReadTokens: result.totalUsage.cacheReadTokens + usage.cacheReadTokens,
        cacheWriteTokens: result.totalUsage.cacheWriteTokens + usage.cacheWriteTokens,
        imageCostUsdMillicents: result.imageCostMillicents,
      },
    });
    return reply.send({
      gameId: game.id,
      orientation: game.orientation,
      language: game.language,
      html: game.html,
      normalized,
    });
  });

  app.post('/:id/refine', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = RefineBody.parse(req.body ?? {});
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.status(404).send({ error: 'not_found' });
    const studentId = getStudentId(req);
    if (game.studentId !== (await ensureStudent(studentId, game.language as 'en' | 'ar')).id) {
      return reply.status(403).send({ error: 'forbidden' });
    }

    // Refinement is a Haiku spec-level edit. Apply to the stored spec, regenerate inner-script.
    const editPrompt = `${body.instruction}\n\nCURRENT_SPEC:\n${JSON.stringify(game.spec)}`;
    const repaired = await generation.generateRepair(JSON.stringify(game.spec), editPrompt, true);
    let newSpec;
    try {
      newSpec = JSON.parse(repaired.html);
    } catch {
      return reply.status(422).send({ error: 'refine_invalid_spec' });
    }
    const codeRes = await generation.generateCode(newSpec, '');
    const { wrapInScaffold } = await import('../pipeline/scaffold.ts');
    const html = await wrapInScaffold({ language: newSpec.language, innerScript: codeRes.innerScript });

    const updated = await prisma.game.update({
      where: { id },
      data: {
        spec: newSpec as unknown as object,
        html,
        inputTokens: game.inputTokens + repaired.usage.inputTokens + codeRes.usage.inputTokens,
        outputTokens: game.outputTokens + repaired.usage.outputTokens + codeRes.usage.outputTokens,
        cacheReadTokens:
          game.cacheReadTokens + repaired.usage.cacheReadTokens + codeRes.usage.cacheReadTokens,
        cacheWriteTokens:
          game.cacheWriteTokens + repaired.usage.cacheWriteTokens + codeRes.usage.cacheWriteTokens,
      },
    });

    return reply.send({ gameId: updated.id, html: updated.html });
  });

  app.post('/:id/level', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = LevelReport.parse(req.body ?? {});
    const studentId = getStudentId(req);
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.status(404).send({ error: 'not_found' });

    await prisma.levelRecord.create({
      data: {
        gameId: id,
        studentId: game.studentId,
        levelIndex: body.level,
        score: body.score,
        accuracy: body.accuracy,
        durationMs: body.durationMs,
      },
    });

    // Update concept_mastery from the spec's content for this level.
    const spec = game.spec as unknown as { levels: Array<{ index: number; contentItems: Array<{ concepts: string[] }> }> };
    const lvl = spec.levels.find((l) => l.index === body.level);
    if (lvl) {
      // Crude: distribute accuracy across all concepts touched in this level.
      const conceptIds = Array.from(
        new Set(lvl.contentItems.flatMap((it) => it.concepts)),
      );
      const attempts = lvl.contentItems.length;
      const correct = Math.round(attempts * body.accuracy);
      for (const c of conceptIds) {
        await prisma.conceptMastery.upsert({
          where: { studentId_conceptId: { studentId: game.studentId, conceptId: c } },
          update: {
            attempts: { increment: attempts },
            correct: { increment: correct },
            lastSeen: new Date(),
          },
          create: { studentId: game.studentId, conceptId: c, attempts, correct },
        });
      }
    }

    return reply.send({ ok: true });
  });

  app.post('/:id/complete', async (req, reply) => {
    const { id } = req.params as { id: string };
    const summary = Summary.parse(req.body ?? {});
    const studentId = getStudentId(req);
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return reply.status(404).send({ error: 'not_found' });

    const stored = await prisma.summary.create({
      data: {
        gameId: id,
        studentId: game.studentId,
        payload: summary as unknown as object,
      },
    });

    // Fire-and-forget enrichment.
    void (async () => {
      try {
        const enr = await generation.generateFeedback(summary, game.language as 'en' | 'ar');
        await prisma.summary.update({
          where: { id: stored.id },
          data: {
            enrichment: enr.enrichment as unknown as object,
            enrichmentReady: true,
            enrichedAt: new Date(),
          },
        });
      } catch (err) {
        logger.error({ err, gameId: id }, 'enrichment.failed');
      }
    })();

    return reply.send({ summaryId: stored.id, enrichmentReady: false });
  });

  app.get('/:id/summary', async (req, reply) => {
    const { id } = req.params as { id: string };
    const s = await prisma.summary.findUnique({ where: { gameId: id } });
    if (!s) return reply.status(404).send({ error: 'not_found' });
    return reply.send({
      payload: s.payload,
      enrichment: s.enrichment,
      enrichmentReady: s.enrichmentReady,
    });
  });

  app.get('/library', async (req, reply) => {
    const studentId = getStudentId(req);
    const student = await prisma.student.findUnique({ where: { externalId: studentId } });
    if (!student) return reply.send({ games: [] });
    const games = await prisma.game.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, topic: true, subject: true, language: true, createdAt: true, templateId: true },
    });
    return reply.send({ games });
  });
}
