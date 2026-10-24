import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { renderDemo } from '../scripts/make-demo.mjs';
import { RULES } from '../src/rules/index.mjs';

const read = (/** @type {string} */ rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('every rule has a row and a section in docs/rules.md', () => {
  const docs = read('docs/rules.md');
  for (const rule of RULES) {
    assert.match(docs, new RegExp(`\\| \\[${rule.id}\\]\\(#${rule.id.toLowerCase()}\\) \\| ${rule.name} \\|`), `${rule.id} table row`);
    assert.ok(docs.includes(`## ${rule.id}`), `${rule.id} section`);
  }
});

test('rule ids are unique and ordered', () => {
  const ids = RULES.map(r => r.id);
  assert.deepEqual(ids, [...new Set(ids)].sort());
  for (const rule of RULES) {
    assert.match(rule.id, /^MCP\d{3}$/);
    assert.ok(rule.summary.length > 10);
  }
});

test('docs/demo.svg is up to date with the real CLI output', () => {
  assert.equal(read('docs/demo.svg'), renderDemo());
});

test('both READMEs show the same real output block and mention every rule', () => {
  for (const file of ['README.md', 'README.tr.md']) {
    const text = read(file);
    for (const rule of RULES) {
      assert.ok(text.includes(rule.id), `${file} mentions ${rule.id}`);
    }
    assert.ok(text.includes('docs/demo.svg'), `${file} embeds the demo`);
    assert.ok(text.includes('6 findings (4 high, 1 medium, 1 low)'), `${file} has the real summary line`);
  }
});

test('no local paths or foreign user names in tracked text files', () => {
  const needles = ['C:/Users/', 'C:\\Users\\y', '/home/y'];
  for (const file of ['README.md', 'README.tr.md', 'CONTRIBUTING.md', 'docs/rules.md', 'docs/demo.svg', 'package.json', 'examples/insecure.mcp.json']) {
    const text = read(file);
    for (const needle of needles) {
      assert.ok(!text.includes(needle), `${file} contains ${needle}`);
    }
  }
});
