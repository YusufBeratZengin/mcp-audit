import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { main } from '../src/cli.mjs';
import { auditText } from '../src/audit.mjs';
import { formatJson } from '../src/report/json.mjs';
import { formatSarif } from '../src/report/sarif.mjs';
import { formatText } from '../src/report/text.mjs';
import { judgePath } from '../src/rules/filesystem.mjs';
import { check } from './helpers.mjs';

test('review 1: output cannot overwrite any source or its hard/symbolic links', t => {
  fs.mkdirSync(new URL('../is/', import.meta.url), { recursive: true });
  const root = fs.mkdtempSync(new URL('../is/output-', import.meta.url));
  try {
    const source = path.join(root, 'config.json');
    const content = '{"mcpServers":{}}';
    fs.writeFileSync(source, content);
    fs.writeFileSync(path.join(root, 'other.json'), content);
    fs.linkSync(source, path.join(root, 'hard.json'));
    const outputs = ['config.json', './config.json', 'hard.json'];
    try {
      fs.symlinkSync(source, path.join(root, 'symbolic.json'));
      outputs.push('symbolic.json');
    } catch (error) {
      if (!['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
        throw error;
      }
      t.diagnostic('Symbolic links unavailable; hard links still checked.');
    }
    for (const output of outputs) {
      let err = '';
      assert.equal(main(['other.json', 'config.json', '--output', output], {
        cwd: root, home: root, env: {},
        stdout: { write: () => {} }, stderr: { write: text => { err += text; } },
      }), 2);
      assert.match(err, /must not overwrite/);
      assert.equal(fs.readFileSync(source, 'utf8'), content);
    }
    // Invalid configs must also be protected.
    fs.writeFileSync(source, '{');
    assert.equal(main(['config.json', '-o', 'config.json'], {
      cwd: root, home: root, env: {},
      stdout: { write: () => {} }, stderr: { write: () => {} },
    }), 2);
    assert.equal(fs.readFileSync(source, 'utf8'), '{');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('review 2: detected literals are masked in every rule and report even with MCP001 ignored', () => {
  const literal = ['DEMO_ONLY', 'CREDENTIAL'].join('_');
  for (const entry of [
    { command: 'npx', args: ['--token', literal] },
    { command: 'npx', args: [literal], env: { API_TOKEN: literal } },
    { command: 'npx', args: [literal], headers: { Authorization: literal } },
    { command: 'npx', args: [literal], url: `http://user:${literal}@example.com` },
    { command: 'npx', args: [literal], url: `http://example.com?token=${literal}` },
  ]) {
    for (const ignore of [[], ['MCP001']]) {
      const { findings, servers } = auditText(JSON.stringify({ mcpServers: { demo: entry } }), 'config.json', { ignore });
      assert.ok(findings.some(f => f.ruleId === 'MCP002'));
      assert.ok(findings.some(f => f.ruleId === 'MCP006'));
      const result = { files: [{ path: 'config.json', servers }], findings, errors: [],
        summary: { files: 1, servers, findings: findings.length, bySeverity: {} } };
      for (const format of [formatJson, formatSarif, formatText]) {
        assert.ok(!format(result).includes(literal));
      }
    }
  }
});

test('review 4: separate cmd arguments still interpret control operators and redirects', () => {
  for (const tail of [['&', 'echo', 'SECOND'], ['&&', 'echo', 'SECOND'], ['|', 'more'], ['>', 'out.txt'], ['2>out.txt'], ['<', 'in.txt']]) {
    assert.ok(check({ s: { command: 'cmd', args: ['/d', '/s', '/c', 'echo', 'FIRST', ...tail] } })
      .some(f => f.ruleId === 'MCP004'));
  }
  assert.ok(!check({ s: { command: 'cmd', args: ['/c', 'npx', '-y', '@modelcontextprotocol/demo@1.2.3'] } })
    .some(f => f.ruleId === 'MCP004'));
});

test('review 5: normalize Windows and POSIX paths before classifying access', () => {
  for (const value of ['C:\\docs\\..', '/tmp/..', 'C:\\docs\\..\\\\', '/tmp//.././']) {
    assert.equal(judgePath(value)?.level, 'root');
    assert.ok(check({ s: { command: 'node', args: [value] } }).some(f => f.ruleId === 'MCP003'));
  }
  assert.equal(judgePath('/tmp/../etc')?.level, 'system');
  assert.equal(judgePath('C:\\Users\\demo\\docs\\..')?.level, 'home');
  assert.equal(judgePath('/projects/./demo/../safe'), undefined);
});

test('review 6: inspect every explicitly requested npm package', () => {
  for (const [command, prefix] of [['npx', []], ['npm', ['exec']], ['pnpm', ['dlx']]]) {
    for (const flags of [
      ['--package', '@modelcontextprotocol/demo@1.2.3', '--package', 'untrusted-demo@latest'],
      ['-p', '@modelcontextprotocol/demo@1.2.3', '-p', 'untrusted-demo@latest'],
      ['--package=@modelcontextprotocol/demo@1.2.3', '--package=untrusted-demo@latest'],
    ]) {
      const hits = check({ s: { command, args: [...prefix, ...flags, '--', 'demo'] } });
      for (const id of ['MCP002', 'MCP006']) {
        assert.ok(hits.some(f => f.ruleId === id && f.message.includes('untrusted-demo')));
      }
      assert.equal(hits.filter(f => f.ruleId === 'MCP002').length, 1);
    }
  }
  const hits = check({ s: { command: 'npx', args: ['-p', '@modelcontextprotocol/demo@1.2.3', '-p', 'mcp-shell@1.0.0', 'demo'] } });
  assert.ok(hits.some(f => f.ruleId === 'MCP004'));
});
