import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { audit, display } from '../src/audit.mjs';
import { discover, knownLocations } from '../src/discover.mjs';

/**
 * Make a scratch tree with `home/` and `work/` directories.
 * @param {Record<string, string>} files Paths relative to the scratch root.
 */
function scratch(files) {
  fs.mkdirSync(new URL('../is/', import.meta.url), { recursive: true });
  const root = fs.mkdtempSync(new URL('../is/audit-', import.meta.url));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.mkdirSync(path.join(root, 'home'), { recursive: true });
  fs.mkdirSync(path.join(root, 'work'), { recursive: true });
  return { root, home: path.join(root, 'home'), cwd: path.join(root, 'work'), done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const bad = JSON.stringify({ mcpServers: { s: { command: 'node', args: ['/'] } } });
const good = JSON.stringify({ mcpServers: { s: { command: 'node', args: ['srv.js'] } } });

test('discover finds project and user files per platform', () => {
  const t = scratch({
    'work/.mcp.json': good,
    'work/.cursor/mcp.json': good,
    'work/.vscode/mcp.json': '{"servers":{}}',
    'home/.claude.json': good,
    'home/.cursor/mcp.json': good,
    'home/AppData/Roaming/Claude/claude_desktop_config.json': good,
    'home/Library/Application Support/Claude/claude_desktop_config.json': good,
    'home/.config/Claude/claude_desktop_config.json': good,
  });
  try {
    const base = { cwd: t.cwd, home: t.home, env: {} };
    const win = discover({ ...base, platform: 'win32' }).map(f => f.client);
    assert.ok(win.includes('Claude Desktop'));
    assert.ok(win.includes('Claude Code (project)'));
    assert.ok(win.includes('Claude Code (user)'));
    assert.ok(discover({ ...base, platform: 'darwin' }).some(f => f.client === 'Claude Desktop'));
    const linux = discover({ ...base, platform: 'linux' });
    assert.ok(linux.some(f => f.client.startsWith('Claude Desktop')));
    assert.ok(linux.every(f => f.confidence));
    assert.equal(discover({ ...base, platform: 'linux', user: false }).every(f => f.scope === 'project'), true);
    assert.equal(discover({ ...base, platform: 'linux', project: false }).every(f => f.scope === 'user'), true);
    const custom = discover({ ...base, platform: 'win32', env: { APPDATA: path.join(t.home, 'elsewhere') } });
    assert.ok(!custom.some(f => f.client === 'Claude Desktop'));
  } finally {
    t.done();
  }
});

test('discover returns nothing when no files exist and every platform lists locations', () => {
  const t = scratch({});
  try {
    assert.deepEqual(discover({ cwd: t.cwd, home: t.home, platform: 'linux', env: {} }), []);
    for (const platform of ['win32', 'darwin', 'linux']) {
      assert.ok(knownLocations(platform).length >= 8);
    }
  } finally {
    t.done();
  }
});

test('audit with no paths discovers files, with relative and home-relative names', () => {
  const t = scratch({ 'work/.mcp.json': bad, 'home/.cursor/mcp.json': good });
  try {
    const result = audit({ cwd: t.cwd, home: t.home, platform: 'linux', env: {} });
    assert.deepEqual(result.files.map(f => f.path), ['.mcp.json', '~/.cursor/mcp.json']);
    assert.equal(result.summary.files, 2);
    assert.equal(result.summary.servers, 2);
    assert.equal(result.summary.findings, 1);
    assert.equal(result.summary.bySeverity.high, 1);
    assert.equal(result.findings[0].file, '.mcp.json');
    assert.equal(result.findings[0].line, 1);
    const projectOnly = audit({ cwd: t.cwd, home: t.home, platform: 'linux', env: {}, user: false });
    assert.equal(projectOnly.files.length, 1);
  } finally {
    t.done();
  }
});

test('audit of explicit file, directory and duplicates', () => {
  const t = scratch({ 'work/.mcp.json': bad, 'other/x.json': bad, 'other/proj/.vscode/mcp.json': '{"servers":{"v":{"url":"http://mcp.example.com"}}}' });
  try {
    const file = path.join(t.root, 'other', 'x.json');
    const result = audit({ paths: [file, file, path.join(t.root, 'other', 'proj')], cwd: t.cwd, home: t.home });
    assert.equal(result.files.length, 2);
    assert.equal(result.findings.length, 2);
    assert.ok(result.files.every(f => !f.path.includes('\\')));
  } finally {
    t.done();
  }
});

test('unreadable and invalid files become errors, explicit ones are flagged', () => {
  const t = scratch({ 'work/broken.json': '{nope', 'work/.mcp.json': '[' });
  try {
    const result = audit({ paths: ['broken.json', 'missing.json'], cwd: t.cwd, home: t.home });
    assert.equal(result.errors.length, 2);
    assert.ok(result.errors.every(e => e.explicit));
    const discovered = audit({ cwd: t.cwd, home: t.home, platform: 'linux', env: {} });
    assert.equal(discovered.errors.length, 1);
    assert.equal(discovered.errors[0].explicit, false);
  } finally {
    t.done();
  }
});

test('display shortens paths', () => {
  assert.equal(display(path.join('/a/b', 'c.json'), '/a', '/h'), 'b/c.json');
  assert.equal(display(path.join('/h', '.x', 'c.json'), '/a', '/h'), '~/.x/c.json');
  assert.equal(display(path.join('/z', 'c.json'), '/a', '/h').endsWith('/z/c.json'), true);
});

test('findings are ordered by file, line, then severity', () => {
  const text = JSON.stringify({ mcpServers: {
    a: { command: 'npx', args: ['-y', 'x'], env: { MY_TOKEN: 'abcdef123456' } },
    b: { url: 'http://mcp.example.com' },
  } }, null, 2);
  const t = scratch({ 'work/.mcp.json': text });
  try {
    const result = audit({ paths: ['.mcp.json'], cwd: t.cwd, home: t.home });
    assert.deepEqual(result.findings.map(f => f.ruleId), ['MCP001', 'MCP002', 'MCP006', 'MCP005']);
  } finally {
    t.done();
  }
});
