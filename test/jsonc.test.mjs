import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonc, stripJsonc } from '../src/jsonc.mjs';

test('parses plain JSON', () => {
  assert.deepEqual(parseJsonc('{"a":[1,2]}'), { a: [1, 2] });
});

test('strips line and block comments and trailing commas', () => {
  const text = '{\n  // note\n  "a": 1, /* c */\n  "b": [1, 2,],\n}\n';
  assert.deepEqual(parseJsonc(text), { a: 1, b: [1, 2] });
});

test('keeps comment markers and commas inside strings', () => {
  const text = '{"url": "http://x/y", "s": "a,}", "q": "say \\"//hi\\""}';
  assert.deepEqual(parseJsonc(text), { url: 'http://x/y', s: 'a,}', q: 'say "//hi"' });
});

test('keeps line numbers stable', () => {
  const text = '{\n/* a\nb */\n"k": 1}';
  assert.equal(stripJsonc(text).split('\n').length, text.split('\n').length);
});

test('tolerates a BOM and an unterminated block comment', () => {
  assert.deepEqual(parseJsonc('\uFEFF{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonc('{"a":1} /* open'), { a: 1 });
});

test('invalid JSON throws', () => {
  assert.throws(() => parseJsonc('{nope'));
});
