import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from '../logger.ts';
import { prisma } from '../db.ts';

export type AutoPatch =
  | { type: 'regex_replace'; pattern: string; replacement: string; flags?: string }
  | { type: 'inject_before'; pattern: string; replacement: string }
  | { type: 'inject_after'; pattern: string; replacement: string };

export type RepairEntry = {
  signature: string;
  occurrences: number;
  last_seen: string;
  root_cause: string;
  fix_template: string;
  auto_patch?: AutoPatch;
  verified: boolean;
};

export type RepairProtocol = { entries: RepairEntry[] };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FILE_PATH = join(__dirname, '..', 'data', 'repair_protocol.json');

let cache: RepairProtocol | null = null;
let cacheLoadedAt = 0;
const TTL_MS = 60_000;

async function load(): Promise<RepairProtocol> {
  if (cache && Date.now() - cacheLoadedAt < TTL_MS) return cache;
  const raw = await readFile(FILE_PATH, 'utf8');
  cache = JSON.parse(raw) as RepairProtocol;
  cacheLoadedAt = Date.now();
  return cache;
}

export async function findEntry(signature: string): Promise<RepairEntry | null> {
  const protocol = await load();
  return protocol.entries.find((e) => e.signature === signature) ?? null;
}

export async function recordOccurrence(signature: string): Promise<void> {
  const protocol = await load();
  const entry = protocol.entries.find((e) => e.signature === signature);
  if (!entry) return;
  entry.occurrences += 1;
  entry.last_seen = new Date().toISOString();
  await writeFile(FILE_PATH, JSON.stringify(protocol, null, 2), 'utf8');
  cacheLoadedAt = Date.now();
  try {
    await prisma.repairProtocolEntry.upsert({
      where: { signature: entry.signature },
      update: { occurrences: entry.occurrences, lastSeen: new Date(entry.last_seen) },
      create: {
        signature: entry.signature,
        occurrences: entry.occurrences,
        lastSeen: new Date(entry.last_seen),
        rootCause: entry.root_cause,
        fixTemplate: entry.fix_template,
        verified: entry.verified,
        ...(entry.auto_patch ? { autoPatch: entry.auto_patch } : {}),
      },
    });
  } catch (err) {
    logger.warn({ err }, 'repair.db_mirror_failed');
  }
}

export async function addEntry(entry: RepairEntry): Promise<void> {
  const protocol = await load();
  if (protocol.entries.find((e) => e.signature === entry.signature)) return;
  protocol.entries.push(entry);
  await writeFile(FILE_PATH, JSON.stringify(protocol, null, 2), 'utf8');
  cacheLoadedAt = Date.now();
  try {
    await prisma.repairProtocolEntry.create({
      data: {
        signature: entry.signature,
        occurrences: entry.occurrences,
        lastSeen: new Date(entry.last_seen),
        rootCause: entry.root_cause,
        fixTemplate: entry.fix_template,
        verified: entry.verified,
        ...(entry.auto_patch ? { autoPatch: entry.auto_patch } : {}),
      },
    });
  } catch (err) {
    logger.warn({ err }, 'repair.db_add_failed');
  }
}

export function applyAutoPatch(html: string, patch: AutoPatch): string {
  switch (patch.type) {
    case 'regex_replace': {
      const re = new RegExp(patch.pattern, patch.flags ?? 'g');
      return html.replace(re, patch.replacement);
    }
    case 'inject_before': {
      const re = new RegExp(patch.pattern);
      return html.replace(re, `${patch.replacement}$&`);
    }
    case 'inject_after': {
      const re = new RegExp(patch.pattern);
      return html.replace(re, `$&${patch.replacement}`);
    }
  }
}
