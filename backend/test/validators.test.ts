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

test('detects missing reportSummary call', () => {
  const spec = makeValidSpec();
  const innerScript = VALID_INNER_SCRIPT.replace('window.EduMindAPI.reportSummary({});', '');
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
