import assert from 'node:assert/strict';
import test from 'node:test';
import { parseJsonc } from '../src/jsonc.mjs';
import { extractServers } from '../src/normalize.mjs';

/**
 * @param {string} text
 */
function servers(text) {
  return extractServers(parseJsonc(text), 'f.json', text);
}

test('reads mcpServers (Claude, Cursor, Windsurf)', () => {
  const [s] = servers('{"mcpServers":{"a":{"command":"npx","args":["-y","x",1],"env":{"K":"v","N":2,"O":{}}}}}');
  assert.equal(s.name, 'a');
  assert.equal(s.scope, 'mcpServers');
  assert.deepEqual(s.args, ['-y', 'x', '1']);
  assert.deepEqual(s.env, { K: 'v', N: '2' });
});

test('reads VS Code servers with url, type and headers', () => {
  const [s] = servers('{"servers":{"r":{"type":"http","url":"https://h/x","headers":{"A":"b"}}}, "inputs":[]}');
  assert.equal(s.scope, 'servers');
  assert.equal(s.url, 'https://h/x');
  assert.equal(s.transport, 'http');
  assert.deepEqual(s.headers, { A: 'b' });
});

test('reads settings.json style mcp.servers and serverUrl', () => {
  const [s] = servers('{"mcp":{"servers":{"w":{"serverUrl":"https://h"}}}}');
  assert.equal(s.scope, 'mcp.servers');
  assert.equal(s.url, 'https://h');
});

test('reads per-project entries of the Claude Code user file', () => {
  const found = servers('{"mcpServers":{"g":{"command":"a"}},"projects":{"/p":{"mcpServers":{"l":{"command":"b"}}},"/q":{}}}');
  assert.deepEqual(found.map(s => s.scope), ['mcpServers', 'projects[/p].mcpServers']);
});

test('finds line numbers, also with comments and repeated names', () => {
  const text = '{\n  // c\n  "mcpServers": {\n    "a": {"command": "x"},\n\n    "b": {"command": "y"}\n  }\n}';
  assert.deepEqual(servers(text).map(s => s.line), [4, 6]);
});

test('names with regex characters are handled', () => {
  const text = '{"mcpServers":{"a.b+c":{"command":"x"}}}';
  assert.equal(servers(text)[0].line, 1);
});

test('without source text lines are 0; non-object entries and roots are ignored', () => {
  assert.equal(extractServers({ mcpServers: { a: { command: 'x' }, b: 'str' } }, 'f')[0].line, 0);
  assert.deepEqual(extractServers([], 'f'), []);
  assert.deepEqual(extractServers({ mcpServers: 5 }, 'f'), []);
});
