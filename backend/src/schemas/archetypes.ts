import * as z from 'zod';
import type { TemplateId } from './gameSpec.ts';

// Archetypes are the *presentation layer* over pedagogical templates.
// Each archetype maps onto exactly one template (the mechanic underneath is unchanged).
export const ARCHETYPE_IDS = ['lane_racer', 'goal_shootout', 'tower_builder', 'quest_path'] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

// Themes are visual variants per archetype.
export const THEMES_BY_ARCHETYPE = {
  lane_racer: ['car_racing_f1', 'car_racing_street', 'motorbike', 'kart'],
  goal_shootout: ['football', 'basketball', 'hockey', 'archery'],
  tower_builder: ['castle', 'rocket', 'skyscraper', 'treehouse'],
  quest_path: ['fantasy', 'sci_fi', 'detective', 'anime'],
} as const satisfies Record<ArchetypeId, readonly string[]>;

export const ALL_THEMES = [
  ...THEMES_BY_ARCHETYPE.lane_racer,
  ...THEMES_BY_ARCHETYPE.goal_shootout,
  ...THEMES_BY_ARCHETYPE.tower_builder,
  ...THEMES_BY_ARCHETYPE.quest_path,
] as const;
export type ThemeId = (typeof ALL_THEMES)[number];

export const Archetype = z.enum(ARCHETYPE_IDS);
export const Theme = z.enum(ALL_THEMES);

// Archetype → underlying pedagogical template
export const ARCHETYPE_TO_TEMPLATE = {
  lane_racer: 'target_practice',
  goal_shootout: 'target_practice',
  tower_builder: 'build_combine',
  quest_path: 'quiz_quest',
} as const satisfies Record<ArchetypeId, TemplateId>;

// Inverse: given a templateId picked by the legacy spec generator, infer a default archetype.
// Used only for backfilling existing rows or fallback paths.
export const TEMPLATE_TO_DEFAULT_ARCHETYPE: Partial<Record<TemplateId, ArchetypeId>> = {
  target_practice: 'lane_racer',
  build_combine: 'tower_builder',
  quiz_quest: 'quest_path',
};

export const DEFAULT_THEMES: Record<ArchetypeId, ThemeId> = {
  lane_racer: 'car_racing_f1',
  goal_shootout: 'football',
  tower_builder: 'castle',
  quest_path: 'fantasy',
};

export function themeBelongsToArchetype(theme: ThemeId, archetype: ArchetypeId): boolean {
  return (THEMES_BY_ARCHETYPE[archetype] as readonly string[]).includes(theme);
}
