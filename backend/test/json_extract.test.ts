import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonObject, stripFences } from '../src/pipeline/strip.ts';

test('extractJsonObject returns input unchanged when already a clean object', () => {
  const raw = '{"a":1,"b":"two"}';
  assert.equal(extractJsonObject(raw), raw);
});

test('extractJsonObject strips prose preamble before JSON', () => {
  const raw = `Looking at the spec, here's the JSON:\n\n{"templateId":"match_pairs","levels":[]}`;
  const got = extractJsonObject(raw);
  assert.equal(got.trim(), '{"templateId":"match_pairs","levels":[]}');
  // Ensure it parses
  const parsed = JSON.parse(got) as { templateId: string };
  assert.equal(parsed.templateId, 'match_pairs');
});

test('extractJsonObject strips trailing prose after balanced object', () => {
  const raw = `{"x":1,"y":{"z":2}}\n\nHope this helps!`;
  const got = extractJsonObject(raw);
  assert.equal(got, '{"x":1,"y":{"z":2}}');
  JSON.parse(got);
});

test('extractJsonObject ignores braces inside string literals', () => {
  const raw = `{"label":"a {curly} string with }brackets{","n":1}`;
  const got = extractJsonObject(raw);
  assert.equal(got, raw);
  JSON.parse(got);
});

test('extractJsonObject finds the first balanced object when there are multiple', () => {
  const raw = `{"first":1}\n\nAnd here's another:\n{"second":2}`;
  const got = extractJsonObject(raw);
  assert.equal(got, '{"first":1}');
});

test('extractJsonObject returns the original on truncated/unbalanced JSON', () => {
  const raw = `{"levels":[{"index":1,"contentItems":[{"id":"a"`;
  // No matching close — extractor falls back to the original so the downstream JSON.parse
  // throws with a useful message instead of the extractor silently returning a partial.
  const got = extractJsonObject(raw);
  assert.equal(got, raw);
  assert.throws(() => JSON.parse(got));
});

test('extractJsonObject handles nested objects + arrays', () => {
  const raw = `Prefix prose {"levels":[{"items":[1,2,{"nested":true}]},{}],"final":{}} suffix`;
  const got = extractJsonObject(raw);
  assert.equal(got, '{"levels":[{"items":[1,2,{"nested":true}]},{}],"final":{}}');
  JSON.parse(got);
});

test('stripFences removes ```json...``` fences', () => {
  const raw = '```json\n{"a":1}\n```';
  assert.equal(stripFences(raw), '{"a":1}');
});

test('stripFences removes bare ```...``` fences', () => {
  const raw = '```\n<html>hi</html>\n```';
  assert.equal(stripFences(raw), '<html>hi</html>');
});

test('stripFences passes through non-fenced input', () => {
  const raw = `<!DOCTYPE html><html></html>`;
  assert.equal(stripFences(raw), raw);
});

test('combined stripFences + extractJsonObject handles the real fail mode (prose + fence)', () => {
  const raw = 'Here you go:\n```json\nLooking at this:\n{"templateId":"match_pairs","levels":[1,2]}\n```';
  const got = extractJsonObject(stripFences(raw));
  JSON.parse(got);
  assert.match(got, /"templateId":"match_pairs"/);
});
