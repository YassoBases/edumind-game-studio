// Boot-time hook: ensures backend/src/data/phaser_4_1_0.min.js exists by copying it from
// node_modules/phaser/dist/phaser.min.js on first run. The scaffold inlines that file in
// production (saves ~250-1350 KB depending on the bundle variant, plus one CDN round-trip
// per page load).
import { access, copyFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { logger } from '../logger.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEST_DIR = join(__dirname, '..', 'data');
const DEST_PATH = join(DEST_DIR, 'phaser_4_1_0.min.js');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function resolvePhaserDistPath(): string | null {
  // Resolve from the backend package's view of node_modules, regardless of CWD.
  try {
    const require_ = createRequire(import.meta.url);
    // phaser's package.json knows its own bundle file paths
    const pkgPath = require_.resolve('phaser/package.json');
    const distDir = join(dirname(pkgPath), 'dist');
    return join(distDir, 'phaser.min.js');
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, 'phaser.resolve_failed');
    return null;
  }
}

/**
 * Ensures the Phaser bundle is staged for inline-in-scaffold. Safe to call on every boot.
 * Logs the action (or no-op) at INFO level.
 */
export async function ensurePhaserBundleInlined(): Promise<void> {
  if (await fileExists(DEST_PATH)) {
    const s = await stat(DEST_PATH);
    logger.info({ path: DEST_PATH, bytes: s.size }, 'phaser.bundle.already_inlined');
    return;
  }
  const src = resolvePhaserDistPath();
  if (!src || !(await fileExists(src))) {
    logger.warn(
      { dest: DEST_PATH, source: src },
      'phaser.bundle.source_missing — scaffold will fall back to CDN script tag',
    );
    return;
  }
  await mkdir(DEST_DIR, { recursive: true });
  await copyFile(src, DEST_PATH);
  const s = await stat(DEST_PATH);
  logger.info({ from: src, to: DEST_PATH, bytes: s.size }, 'phaser.bundle.inlined');
}
