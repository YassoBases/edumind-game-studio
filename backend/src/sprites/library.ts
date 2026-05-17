import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.ts';
import type { ArchetypeId, ThemeId } from '../schemas/archetypes.ts';
import { defaultRolesFor, generatePlaceholder } from './placeholders.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPRITES_ROOT = join(__dirname, '..', '..', 'sprites');
const LIBRARY_ROOT = join(SPRITES_ROOT, 'library');

type Manifest = {
  themes: Record<string, Record<string, string>>;
};

let manifestCache: Manifest | null = null;
async function loadManifest(): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  const raw = await readFile(join(SPRITES_ROOT, 'manifest.json'), 'utf8');
  manifestCache = JSON.parse(raw) as Manifest;
  return manifestCache;
}

const fileCache = new Map<string, string>();

async function readAsBase64DataUri(absPath: string): Promise<string | null> {
  const cached = fileCache.get(absPath);
  if (cached) return cached;
  try {
    await stat(absPath);
    const buf = await readFile(absPath);
    const ext = absPath.toLowerCase().endsWith('.png') ? 'image/png' : absPath.toLowerCase().endsWith('.jpg') || absPath.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
    const uri = `data:${ext};base64,${buf.toString('base64')}`;
    fileCache.set(absPath, uri);
    return uri;
  } catch {
    return null;
  }
}

export type LibrarySpriteSet = Record<string, string>; // role → base64 data URI

export async function loadLibrarySprites(
  archetype: ArchetypeId,
  theme: ThemeId,
): Promise<LibrarySpriteSet> {
  const manifest = await loadManifest();
  const themeEntry = manifest.themes[theme] ?? {};
  const roles = defaultRolesFor(archetype);
  const out: LibrarySpriteSet = {};
  for (const role of roles) {
    const relPath = themeEntry[role];
    let uri: string | null = null;
    if (relPath) {
      const abs = join(SPRITES_ROOT, relPath);
      uri = await readAsBase64DataUri(abs);
    }
    if (!uri) {
      uri = generatePlaceholder(theme, role);
    }
    if (uri) {
      out[role] = uri;
    } else {
      logger.warn({ theme, role }, 'sprite.missing_no_placeholder');
    }
  }
  return out;
}

export function libraryRolesFor(archetype: ArchetypeId): string[] {
  return defaultRolesFor(archetype);
}

// Exposed for tests
export const __testing = { LIBRARY_ROOT };
