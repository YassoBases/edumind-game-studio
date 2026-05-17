import type { ArchetypeId, ThemeId } from '../schemas/archetypes.ts';
import type { GameSpec } from '../schemas/gameSpec.ts';
import { loadLibrarySprites } from './library.ts';
import { generateTopicSprites, type GeneratedSpriteSet } from './generated.ts';
import { logger } from '../logger.ts';

export type SpriteManifest = {
  library: Record<string, string>;
  generated: Record<string, string>;
};

export type ComposedSprites = {
  manifest: SpriteManifest;
  costMillicents: number;
  provider: string;
};

export async function composeSprites(
  spec: GameSpec,
  archetype: ArchetypeId,
  theme: ThemeId,
): Promise<ComposedSprites> {
  const t0 = Date.now();
  // Library load is cheap (filesystem + SVG generation). Run in parallel with generated icons.
  const libraryP = loadLibrarySprites(archetype, theme);
  const conceptRequests = spec.concepts.slice(0, 6).map((c) => ({
    archetype,
    theme,
    conceptId: c.id,
    conceptLabel: c.label,
    topic: spec.topic,
    subject: spec.subject,
    kind: 'concept' as const,
  }));
  // One background per game keyed by "theme_background".
  const backgroundRequest = {
    archetype,
    theme,
    conceptId: 'theme_background',
    conceptLabel: `${theme} backdrop for ${spec.topic}`,
    topic: spec.topic,
    subject: spec.subject,
    kind: 'background' as const,
  };
  const generatedP = generateTopicSprites([backgroundRequest, ...conceptRequests]);

  const [library, generated] = await Promise.all([libraryP, generatedP]);
  const dt = Date.now() - t0;
  logger.info(
    {
      archetype,
      theme,
      libraryCount: Object.keys(library).length,
      generatedCount: Object.keys(generated.sprites).length,
      latencyMs: dt,
      provider: generated.provider,
      costMillicents: generated.costMillicents,
    },
    'sprites.composed',
  );

  return {
    manifest: { library, generated: generated.sprites as GeneratedSpriteSet },
    costMillicents: generated.costMillicents,
    provider: generated.provider,
  };
}
