import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));

type AdaptiveEngine = {
  currentLevel: number;
  completeLevel(input: {
    correct: number;
    attempts: number;
    timeUsedMs: number;
    timeLimitMs: number;
    hintsUsed: number;
    maxHints: number;
    attemptedItems?: Array<{ id: string; concepts: string[] }>;
    correctItems?: string[];
  }): { score: number; accuracy: number; nextLevel: number; stopReason: string | null };
  buildSummary(): {
    masteryAchieved: boolean;
    levelsPlayed: number;
    totalScore: number;
    conceptMastery: Array<{ conceptId: string; mastered: boolean; attempts: number }>;
  };
};

type EduCoreGlobal = {
  setLanguage(l: string): void;
  AdaptiveEngine: { create(spec: object): AdaptiveEngine };
};

async function loadEduCore(): Promise<EduCoreGlobal> {
  const src = await readFile(join(__dirname, '..', 'client', 'EduCore.js'), 'utf8');
  const sandbox: { window: { EduCore?: EduCoreGlobal } } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  if (!sandbox.window.EduCore) throw new Error('EduCore did not load');
  return sandbox.window.EduCore;
}

function spec() {
  return {
    topic: 'Test',
    subject: 'Test',
    concepts: [
      { id: 'c1', label: 'Concept 1', description: '' },
      { id: 'c2', label: 'Concept 2', description: '' },
    ],
  };
}

test('scoreLevel formula: high accuracy → next level + 2', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  const r = e.completeLevel({
    correct: 10,
    attempts: 10,
    timeUsedMs: 1000,
    timeLimitMs: 90000,
    hintsUsed: 0,
    maxHints: 3,
  });
  assert.ok(r.score >= 0.85, `score ${r.score} should be ≥ 0.85`);
  assert.equal(r.nextLevel, 3);
});

test('mid-range score keeps the level the same', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  const r = e.completeLevel({
    correct: 5,
    attempts: 10,
    timeUsedMs: 60000,
    timeLimitMs: 90000,
    hintsUsed: 2,
    maxHints: 3,
  });
  assert.ok(r.score >= 0.4 && r.score < 0.65, `mid score expected, got ${r.score}`);
  assert.equal(r.nextLevel, 1);
});

test('three consecutive low scores trigger frustration stopReason', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  for (let i = 0; i < 2; i += 1) {
    e.completeLevel({ correct: 0, attempts: 10, timeUsedMs: 90000, timeLimitMs: 90000, hintsUsed: 3, maxHints: 3 });
  }
  const r = e.completeLevel({ correct: 0, attempts: 10, timeUsedMs: 90000, timeLimitMs: 90000, hintsUsed: 3, maxHints: 3 });
  assert.equal(r.stopReason, 'frustration');
});

test('mastery: 3 consecutive ≥0.80 scores triggers mastery', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  for (let i = 0; i < 3; i += 1) {
    e.completeLevel({ correct: 9, attempts: 10, timeUsedMs: 30000, timeLimitMs: 90000, hintsUsed: 0, maxHints: 3 });
  }
  const s = e.buildSummary();
  assert.equal(s.masteryAchieved, true);
});

test('hard cap: 7 levels played stops session', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  let stop: string | null = null;
  for (let i = 0; i < 7; i += 1) {
    const r = e.completeLevel({ correct: 5, attempts: 10, timeUsedMs: 60000, timeLimitMs: 90000, hintsUsed: 1, maxHints: 3 });
    stop = r.stopReason;
  }
  assert.equal(stop, 'cap');
});

test('concept mastery: ≥3 attempts AND ≥0.75 accuracy', async () => {
  const EduCore = await loadEduCore();
  const e = EduCore.AdaptiveEngine.create(spec());
  const items = [
    { id: 'a', concepts: ['c1'] },
    { id: 'b', concepts: ['c1'] },
    { id: 'c', concepts: ['c1'] },
    { id: 'd', concepts: ['c2'] },
  ];
  e.completeLevel({
    correct: 3,
    attempts: 4,
    timeUsedMs: 30000,
    timeLimitMs: 90000,
    hintsUsed: 0,
    maxHints: 3,
    attemptedItems: items,
    correctItems: ['a', 'b', 'c'],
  });
  const s = e.buildSummary();
  const c1 = s.conceptMastery.find((c) => c.conceptId === 'c1');
  const c2 = s.conceptMastery.find((c) => c.conceptId === 'c2');
  assert.ok(c1?.mastered, 'c1 should be mastered (3/3)');
  assert.equal(c2?.mastered, false, 'c2 should not be mastered (0/1)');
});
