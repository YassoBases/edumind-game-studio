import { createHash } from 'node:crypto';
import { env } from '../env.ts';
import { logger } from '../logger.ts';
import { prisma } from '../db.ts';
import type { ArchetypeId, ThemeId } from '../schemas/archetypes.ts';

export type GeneratedSpriteRequest = {
  archetype: ArchetypeId;
  theme: ThemeId;
  conceptId: string;          // doubles as the manifest key; use "theme_background" for the backdrop
  conceptLabel: string;
  topic: string;
  subject: string;
  kind: 'concept' | 'background';
};

export type GeneratedSpriteSet = Record<string, string>; // conceptId → base64 data URI

const MAX_SPRITES_PER_GAME = 7; // 6 concept icons + 1 background
const MAX_USD_MILLICENTS_PER_GAME = 15_000; // 15¢ in millicents (1 dollar = 100_000 millicents)

// Approx cost per Flux Schnell image — $0.003 on fal.ai as of May 2026.
// Fudge factor for safety: bill 300 millicents (0.3¢) per image so 6 images = 1.8¢ << 15¢ cap.
const MILLICENTS_PER_IMAGE = 300;

function cacheKey(req: GeneratedSpriteRequest): string {
  return createHash('sha256')
    .update(`${req.archetype}|${req.theme}|${req.conceptId}|${req.topic}|${req.subject}`)
    .digest('hex')
    .slice(0, 24);
}

function buildPrompt(req: GeneratedSpriteRequest): string {
  if (req.kind === 'background') {
    // Phone-portrait full-screen backdrop. No text. Match the theme aesthetic and topic vibe.
    return `${req.theme.replace(/_/g, ' ')} themed game background, ${req.topic} educational atmosphere, vertical mobile aspect, vibrant cinematic illustration, no text, no characters in foreground, distant scenery, clean composition, 720x1280`;
  }
  // Concept icons: flat vector, clean silhouette, Kenney-style.
  return `${req.conceptLabel}, ${req.topic} education icon, flat vector cartoon, clean silhouette, bright colors, centered on transparent background, minimalist game sprite, no text, 512x512`;
}

type ProviderImpl = {
  generate(prompt: string): Promise<string | null>; // returns base64 data URI or null
};

function falProvider(apiKey: string, baseUrl: string): ProviderImpl {
  return {
    async generate(prompt) {
      try {
        const isBackground = /720x1280|vertical mobile|background/i.test(prompt);
        const submitRes = await fetch(`${baseUrl}/fal-ai/flux/schnell`, {
          method: 'POST',
          headers: { 'authorization': `Key ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt,
            image_size: isBackground ? 'portrait_16_9' : 'square',
            num_inference_steps: 4,
            enable_safety_checker: true,
          }),
        });
        if (!submitRes.ok) {
          logger.warn({ status: submitRes.status }, 'image.fal.submit_failed');
          return null;
        }
        const submit = (await submitRes.json()) as { request_id?: string; images?: Array<{ url: string }> };
        // fal.ai flux schnell often returns synchronously; if not, poll.
        let images = submit.images;
        if (!images && submit.request_id) {
          for (let i = 0; i < 15; i += 1) {
            await new Promise((r) => setTimeout(r, 1000));
            const poll = await fetch(`${baseUrl}/fal-ai/flux/requests/${submit.request_id}`, {
              headers: { 'authorization': `Key ${apiKey}` },
            });
            if (!poll.ok) continue;
            const body = (await poll.json()) as { status?: string; images?: Array<{ url: string }> };
            if (body.status === 'COMPLETED' && body.images) {
              images = body.images;
              break;
            }
          }
        }
        const url = images?.[0]?.url;
        if (!url) return null;
        const imgRes = await fetch(url);
        if (!imgRes.ok) return null;
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch (err) {
        logger.warn({ err }, 'image.fal.error');
        return null;
      }
    },
  };
}

function replicateProvider(apiKey: string, baseUrl: string): ProviderImpl {
  // Replicate Flux Schnell: black-forest-labs/flux-schnell
  return {
    async generate(prompt) {
      try {
        const res = await fetch(`${baseUrl}/v1/models/black-forest-labs/flux-schnell/predictions`, {
          method: 'POST',
          headers: {
            'authorization': `Token ${apiKey}`,
            'content-type': 'application/json',
            'prefer': 'wait',
          },
          body: JSON.stringify({
            input: {
              prompt,
              num_outputs: 1,
              aspect_ratio: '1:1',
              output_format: 'png',
              num_inference_steps: 4,
            },
          }),
        });
        if (!res.ok) {
          logger.warn({ status: res.status }, 'image.replicate.failed');
          return null;
        }
        const body = (await res.json()) as { output?: string[] | string };
        const url = Array.isArray(body.output) ? body.output[0] : body.output;
        if (!url) return null;
        const imgRes = await fetch(url);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch (err) {
        logger.warn({ err }, 'image.replicate.error');
        return null;
      }
    },
  };
}

function resolveProvider(): ProviderImpl | null {
  const provider = process.env.IMAGE_PROVIDER ?? 'disabled';
  if (provider === 'disabled') return null;
  const apiKey = process.env.IMAGE_PROVIDER_API_KEY ?? '';
  const baseUrl = process.env.IMAGE_PROVIDER_BASE_URL ?? '';
  if (!apiKey) return null;
  if (provider === 'flux_schnell' || provider === 'fal') {
    return falProvider(apiKey, baseUrl || 'https://fal.run');
  }
  if (provider === 'replicate') {
    return replicateProvider(apiKey, baseUrl || 'https://api.replicate.com');
  }
  return null;
}

export async function generateTopicSprites(
  requests: GeneratedSpriteRequest[],
): Promise<{ sprites: GeneratedSpriteSet; costMillicents: number; provider: string }> {
  const provider = resolveProvider();
  const providerLabel = process.env.IMAGE_PROVIDER ?? 'disabled';
  if (!provider) {
    logger.info({ provider: providerLabel }, 'image.provider.disabled');
    return { sprites: {}, costMillicents: 0, provider: providerLabel };
  }

  const trimmed = requests.slice(0, MAX_SPRITES_PER_GAME);
  let runningCostMillicents = 0;
  const out: GeneratedSpriteSet = {};

  await Promise.all(
    trimmed.map(async (req) => {
      const key = cacheKey(req);
      // Cache lookup
      try {
        const hit = await prisma.spriteCache.findUnique({ where: { cacheKey: key } });
        if (hit) {
          out[req.conceptId] = hit.base64Data;
          await prisma.spriteCache.update({
            where: { cacheKey: key },
            data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
          });
          return;
        }
      } catch (err) {
        logger.warn({ err }, 'image.cache.lookup_failed');
      }

      if (runningCostMillicents + MILLICENTS_PER_IMAGE > MAX_USD_MILLICENTS_PER_GAME) {
        logger.warn({ conceptId: req.conceptId, runningCostMillicents }, 'image.budget.exceeded_skip');
        return;
      }

      const prompt = buildPrompt(req);
      const data = await provider.generate(prompt);
      if (!data) {
        logger.warn({ conceptId: req.conceptId }, 'image.generation_returned_null');
        return;
      }
      out[req.conceptId] = data;
      runningCostMillicents += MILLICENTS_PER_IMAGE;

      try {
        await prisma.spriteCache.create({
          data: {
            cacheKey: key,
            archetype: req.archetype,
            themeId: req.theme,
            conceptId: req.conceptId,
            role: 'concept_icon',
            base64Data: data,
            promptUsed: prompt,
            byteSize: data.length,
          },
        });
      } catch (err) {
        logger.warn({ err }, 'image.cache.write_failed');
      }
    }),
  );

  return { sprites: out, costMillicents: runningCostMillicents, provider: providerLabel };
}

// Exposed for env.ts validation skip — these envs are optional.
export const IMAGE_ENV_OPTIONAL = ['IMAGE_PROVIDER', 'IMAGE_PROVIDER_API_KEY', 'IMAGE_PROVIDER_BASE_URL'];
