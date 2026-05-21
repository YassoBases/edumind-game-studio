// Cost lever B — SpecCache.
// Caches generated specs by content key so repeat requests (e.g. a classroom of students
// all working on the same topic) skip the spec generation call entirely.
//
// Cache key = sha256(subject|topic|language|archetype|themeFamily|difficulty|sessionLength).
// TTL 24h. Bypass when student explicitly hits Refine — they want something different.
import { createHash } from 'node:crypto';
import { logger } from '../logger.ts';
import { prisma } from '../db.ts';
import { GameSpec, type GameSpec as GameSpecT } from '../schemas/gameSpec.ts';
import type { ArchetypeId, ThemeId } from '../schemas/archetypes.ts';

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

export type SpecCacheKey = {
  subject: string;
  topic: string;
  language: 'en' | 'ar';
  archetype: ArchetypeId | null;
  themeId: ThemeId | null;
  difficulty?: string | undefined;
  sessionLength?: string | undefined;
};

export function makeSpecCacheKey(k: SpecCacheKey): string {
  // Theme family = the archetype's full theme group, so a different theme variant within
  // the same archetype family still hits (mostly cosmetic).
  const themeFamily = k.archetype ?? 'none';
  const parts = [
    (k.subject || '').trim().toLowerCase(),
    (k.topic || '').trim().toLowerCase(),
    k.language || 'en',
    k.archetype ?? 'none',
    themeFamily,
    k.difficulty ?? 'standard',
    k.sessionLength ?? 'standard',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

export async function lookupSpec(key: string): Promise<GameSpecT | null> {
  try {
    const row = await prisma.specCache.findUnique({ where: { cacheKey: key } });
    if (!row) return null;
    const ageSeconds = (Date.now() - row.createdAt.getTime()) / 1000;
    if (ageSeconds > row.ttlSeconds) {
      logger.info({ key, ageSeconds }, 'spec_cache.stale');
      return null;
    }
    // Increment hit counter + bump lastUsedAt (fire and forget)
    void prisma.specCache.update({
      where: { cacheKey: key },
      data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch((err) => logger.warn({ err }, 'spec_cache.hit_update_failed'));
    const parsed = GameSpec.safeParse(row.spec);
    if (!parsed.success) {
      logger.warn({ key }, 'spec_cache.row_schema_mismatch_discarded');
      return null;
    }
    logger.info({ key, hitCount: row.hitCount + 1 }, 'spec_cache.hit');
    return parsed.data;
  } catch (err) {
    logger.warn({ err }, 'spec_cache.lookup_failed');
    return null;
  }
}

export async function storeSpec(
  key: string,
  spec: GameSpecT,
  meta: { archetype: ArchetypeId | null; themeId: ThemeId | null; model: string },
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await prisma.specCache.upsert({
      where: { cacheKey: key },
      update: { spec: spec as unknown as object, model: meta.model, lastUsedAt: new Date() },
      create: {
        cacheKey: key,
        spec: spec as unknown as object,
        archetypeId: meta.archetype,
        themeId: meta.themeId,
        model: meta.model,
        ttlSeconds,
      },
    });
  } catch (err) {
    // Cache writes are best-effort — never block generation on cache write failures.
    logger.warn({ err }, 'spec_cache.store_failed');
  }
}
