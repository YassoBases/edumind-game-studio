import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { TemplateId } from '../schemas/gameSpec.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');
const CLIENT_DIR = join(__dirname, '..', '..', 'client');

const cache = new Map<string, string>();

export async function loadTemplate(id: TemplateId): Promise<string> {
  const key = `tpl:${id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const path = join(TEMPLATES_DIR, `${id}.html`);
  const raw = await readFile(path, 'utf8');
  cache.set(key, raw);
  return raw;
}

export async function loadEduCore(): Promise<string> {
  const hit = cache.get('educore');
  if (hit) return hit;
  const raw = await readFile(join(CLIENT_DIR, 'EduCore.js'), 'utf8');
  cache.set('educore', raw);
  return raw;
}

export async function loadGameFeel(): Promise<string> {
  const hit = cache.get('gamefeel');
  if (hit) return hit;
  const raw = await readFile(join(CLIENT_DIR, 'GameFeel.js'), 'utf8');
  cache.set('gamefeel', raw);
  return raw;
}

export async function loadMascot(): Promise<string> {
  const hit = cache.get('mascot');
  if (hit) return hit;
  const raw = await readFile(join(CLIENT_DIR, 'Mascot.js'), 'utf8');
  cache.set('mascot', raw);
  return raw;
}

export async function loadArabicFontBase64(): Promise<string> {
  const hit = cache.get('font');
  if (hit) return hit;
  try {
    const raw = await readFile(join(__dirname, '..', 'data', 'arabic_font_base64.txt'), 'utf8');
    cache.set('font', raw.trim());
    return raw.trim();
  } catch {
    // Empty fallback. Backend will still wrap the scaffold; Arabic text will fall back to
    // system fonts until the operator drops a Noto Sans Arabic woff2 base64 here.
    return '';
  }
}

const PHASER_CDN_TAG =
  '<script src="https://cdn.jsdelivr.net/npm/phaser@4.1.0/dist/phaser.min.js"></script>';

let phaserBundleCache: string | null = null;
export async function loadPhaserBundle(): Promise<string> {
  if (phaserBundleCache !== null) return phaserBundleCache;
  try {
    const raw = await readFile(join(__dirname, '..', 'data', 'phaser_4_1_0.min.js'), 'utf8');
    phaserBundleCache = raw;
  } catch {
    phaserBundleCache = '';
  }
  return phaserBundleCache;
}

export const PHASER_CDN = PHASER_CDN_TAG;
