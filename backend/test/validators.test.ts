import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runValidators } from '../src/pipeline/validators.ts';
import { makeValidSpec, VALID_INNER_SCRIPT } from './fixtures.ts';

test('valid spec + script passes all validators', () => {
  const spec = makeValidSpec();
  const html = `<html><body><script>${VALID_INNER_SCRIPT}</script></body></html>`;
  const results = runValidators({ html, innerScript: VALID_INNER_SCRIPT, spec });
  const failures = results.filter((r) => !r.ok);
  assert.equal(failures.length, 0, `Unexpected failures: ${JSON.stringify(failures, null, 2)}`);
});

test('detects localStorage usage', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nlocalStorage.setItem("a","b");';
  const html = `<html><body><script>${innerScript}</script></body></html>`;
  const results = runValidators({ html, innerScript, spec });
  const f = results.find((r) => r.name === 'no_browser_storage');
  assert.ok(f && !f.ok);
  assert.equal(f.signature, 'browser_storage:localStorage');
});

test('detects missing reportSummary call (legacy bridge path)', () => {
  const spec = makeValidSpec();
  // Legacy: direct EduMindAPI.* calls. Missing reportSummary should be flagged.
  const innerScript = `
    const SPEC = {};
    const engine = window.EduCore.AdaptiveEngine.create(SPEC);
    const score = window.EduCore.makeScoreHud(this, 24, 24);
    window.EduMindAPI.reportLevel(1, 0.8, 0.8, 1000);
    // (summary call deliberately omitted)
    window.EduMindAPI.reportComplete(0, true, 0);
  `;
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
  });
  const f = results.find((r) => r.name === 'bridge_calls_present');
  assert.ok(f && !f.ok);
  assert.match(f.signature, /reportSummary/);
});

test('detects setTintFill Phaser 3 API', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nthis.add.sprite(0,0,"x").setTintFill(0xff0000);';
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
  });
  const f = results.find((r) => r.name === 'phaser4_api_check');
  assert.ok(f && !f.ok);
});

test('detects too few content items', () => {
  const spec = makeValidSpec();
  spec.levels[0].contentItems = spec.levels[0].contentItems.slice(0, 2);
  const results = runValidators({
    html: `<html><body><script>${VALID_INNER_SCRIPT}</script></body></html>`,
    innerScript: VALID_INNER_SCRIPT,
    spec,
  });
  const f = results.find((r) => r.name === 'content_length_total');
  assert.ok(f && !f.ok);
});

test('Arabic spec requires rtl:true on raw add.text', () => {
  const spec = makeValidSpec();
  spec.language = 'ar';
  const innerScript = VALID_INNER_SCRIPT + '\nthis.add.text(10, 10, "hello", { fontSize: "30px" });';
  const results = runValidators({
    html: `<html dir="rtl"><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
  });
  const f = results.find((r) => r.name === 'rtl_support_if_arabic');
  assert.ok(f && !f.ok);
});

test('sprite_assets_referenced_exist passes when no manifest is attached (legacy specs)', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nthis.textures.exists("lib:player");';
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
    // no spriteManifest
  });
  const f = results.find((r) => r.name === 'sprite_assets_referenced_exist');
  assert.ok(f && f.ok, 'should pass silently when manifest is absent');
});

test('sprite_assets_referenced_exist flags missing library role', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nEduSprites.library.unknown_role;';
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
    spriteManifest: { library: { player: 'data:...' }, generated: {} },
  });
  const f = results.find((r) => r.name === 'sprite_assets_referenced_exist');
  assert.ok(f && !f.ok);
  assert.match(f.signature, /sprite_missing/);
});

test('sprite_assets_referenced_exist flags missing generated concept', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nEduSprites.generated["never_generated"];';
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
    spriteManifest: { library: {}, generated: { other_concept: 'data:...' } },
  });
  const f = results.find((r) => r.name === 'sprite_assets_referenced_exist');
  assert.ok(f && !f.ok);
});

test('sprite_assets_referenced_exist passes when all refs resolve', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT + '\nEduSprites.library.player;\nEduSprites.generated["c1"];';
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
    spriteManifest: { library: { player: 'data:...' }, generated: { c1: 'data:...' } },
  });
  const f = results.find((r) => r.name === 'sprite_assets_referenced_exist');
  assert.ok(f && f.ok);
});

test('uses_gamefeel flags games with no GameFeel calls', () => {
  const spec = makeValidSpec();
  const bareScript = `
    const SPEC = {};
    const engine = window.EduCore.AdaptiveEngine.create(SPEC);
    class MenuScene extends Phaser.Scene {}
    class GameScene extends Phaser.Scene {
      create() {
        const score = window.EduCore.makeScoreHud(this, 24, 24);
        const timer = window.EduCore.makeTimerHud(this, 696, 24, 60);
        window.EduMindAPI.reportLevel(1, 0.8, 0.8, 1000);
        window.EduMindAPI.reportSummary({});
        window.EduMindAPI.reportComplete(0, true, 0);
        this.add.rectangle(360, 640, 200, 100, 0x1f2937).setInteractive({ useHandCursor: true });
      }
    }
    class EndScene extends Phaser.Scene {}
    new Phaser.Game({ scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  `;
  const results = runValidators({
    html: `<html><body><script>${bareScript}</script></body></html>`,
    innerScript: bareScript,
    spec,
  });
  const f = results.find((r) => r.name === 'uses_gamefeel');
  assert.ok(f && !f.ok);
  assert.equal(f.signature, 'no_gamefeel_calls');
});

test('uses_gamefeel flags games with only one method called repeatedly', () => {
  const spec = makeValidSpec();
  const innerScript = `
    ${VALID_INNER_SCRIPT.replace(/window\.GameFeel\..+\n/g, '')}
    window.GameFeel.scorePopup(this, 1, 1, '+1', 0);
    window.GameFeel.scorePopup(this, 2, 2, '+2', 0);
    window.GameFeel.scorePopup(this, 3, 3, '+3', 0);
    window.GameFeel.scorePopup(this, 4, 4, '+4', 0);
    window.GameFeel.scorePopup(this, 5, 5, '+5', 0);
    window.GameFeel.scorePopup(this, 6, 6, '+6', 0);
  `;
  const results = runValidators({
    html: `<html><body><script>${innerScript}</script></body></html>`,
    innerScript,
    spec,
  });
  const f = results.find((r) => r.name === 'uses_gamefeel');
  assert.ok(f && !f.ok, 'should fail with only 1 distinct method');
  assert.match(f.signature, /^gamefeel_low/);
});

test('uses_gamefeel passes the standard valid fixture (5 distinct calls)', () => {
  const spec = makeValidSpec();
  const results = runValidators({
    html: `<html><body><script>${VALID_INNER_SCRIPT}</script></body></html>`,
    innerScript: VALID_INNER_SCRIPT,
    spec,
  });
  const f = results.find((r) => r.name === 'uses_gamefeel');
  assert.ok(f && f.ok, `expected pass, got ${f?.signature}: ${f?.detail}`);
});
