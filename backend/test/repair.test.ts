import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAutoPatch, findEntry } from '../src/pipeline/repairProtocol.ts';

test('seed protocol contains 12 entries', async () => {
  const sigs = [
    'browser_storage:localStorage',
    'bridge_missing:reportSummary',
    'scenes:4',
    'no_educore:window.EduCore.makeScoreHud',
    'levels:3',
    'content_short:18',
    'concept_missing_on_item',
    'keyboard_input',
    'phaser3_api:setTintFill (use setTint + setTintMode in Phaser 4)',
    'rtl_missing',
    'font_small:18',
    'external_resource:https://fonts.googleapis.com/css2',
  ];
  for (const s of sigs) {
    const e = await findEntry(s);
    assert.ok(e, `Missing entry: ${s}`);
  }
});

test('regex_replace auto-patch strips localStorage', () => {
  const before = 'foo(); localStorage.setItem("a", "b"); bar();';
  const after = applyAutoPatch(before, {
    type: 'regex_replace',
    pattern: 'localStorage\\.[a-zA-Z]+\\([^)]*\\);?',
    replacement: '/* removed */',
  });
  assert.ok(!after.includes('localStorage.setItem'));
  assert.ok(after.includes('/* removed */'));
});

test('regex_replace auto-patch fixes setTintFill', () => {
  const before = 'sprite.setTintFill(0xff0000);';
  const after = applyAutoPatch(before, {
    type: 'regex_replace',
    pattern: '\\.setTintFill\\(([^)]+)\\)',
    replacement: '.setTint($1).setTintMode(1)',
  });
  assert.equal(after, 'sprite.setTint(0xff0000).setTintMode(1);');
});

test('unknown signature returns null', async () => {
  const e = await findEntry('does_not_exist:xyz');
  assert.equal(e, null);
});
