import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { audit, auditText, extractServers, formatJson, formatSarif, formatText } from '../src/index.mjs';
import { main, parseArgs } from '../src/cli.mjs';
import { check, fake } from './helpers.mjs';
import { hostKind } from '../src/rules/transport.mjs';

test('DNS names resembling private IPv4 addresses stay remote', () => {
  for (const host of ['127.attacker.example', '10.attacker.example', '192.168.example', '172.20.example']) {
    assert.equal(hostKind(`http://${host}`), 'remote');
    assert.equal(check({ s: { url: `http://${host}` } })[0].severity, 'high');
  }
  assert.equal(hostKind('http://127.1'), 'local');
  assert.equal(hostKind('http://localhost./'), 'local');
});

test('secrets in endpoint paths, install URLs and malformed JSON do not leak into reports', () => {
  fs.mkdirSync(new URL('../is/', import.meta.url), { recursive: true });
  const root = fs.mkdtempSync(new URL('../is/privacy-', import.meta.url));
  const secret = fake.github();
  const values = [
    JSON.stringify({ mcpServers: { remote: { url: `http://mcp.example.com/${secret}` } } }),
    JSON.stringify({ mcpServers: { install: { command: 'npx', args: [`https://u:${secret}@example.com/package.tgz`] } } }),
    `{"mcpServers":{},"token":"${secret}",broken}`,
  ];
  try {
    for (const value of values) {
      fs.writeFileSync(path.join(root, 'config.json'), value);
      const result = audit({ cwd: root, home: root, paths: ['config.json'] });
      assert.ok(result.findings.length || result.errors.length);
      for (const format of [formatJson, formatSarif, formatText]) {
        assert.ok(!format(result).includes(secret));
      }
      if (result.errors.length) {
        assert.equal(result.errors[0].message, 'Invalid JSON/JSONC configuration.');
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('URL credentials in argument lists are detected without known token prefixes', () => {
  const hits = check({ s: { command: 'node', args: ['http://user:demonstration-only@example.com/api'] } });
  assert.ok(hits.some(hit => hit.ruleId === 'MCP001'));
  assert.ok(!JSON.stringify(hits).includes('demonstration-only'));
});

test('other rules cannot echo known tokens mistaken for package names or versions', () => {
  const secret = fake.github();
  for (const spec of [secret, `example-package@${secret}`]) {
    const hits = check({ s: { command: 'npx', args: [spec] } });
    assert.ok(hits.some(hit => hit.ruleId === 'MCP001'));
    assert.ok(hits.some(hit => hit.ruleId === 'MCP006'));
    assert.ok(!JSON.stringify(hits).includes(secret));
  }
});

test('CLI supports -- for filenames and rejects values on boolean flags', () => {
  assert.deepEqual(parseArgs(['--', '-config.json']).paths, ['-config.json']);
  assert.ok(parseArgs(['--no-user=false']).error);
  for (const option of ['--output', '--trust', '--ignore', '--format']) {
    assert.ok(parseArgs([option, '--help']).error);
  }
});

test('NO_COLOR presence disables color even when its value is empty', () => {
  let out = '';
  const code = main(['examples/insecure.mcp.json'], {
    stdout: { isTTY: true, write: value => { out += value; } },
    env: { NO_COLOR: '' },
  });
  assert.equal(code, 1);
  assert.ok(!out.includes('\u001b['));
});

test('invalid discovered configurations return a failure exit code', () => {
  fs.mkdirSync(new URL('../is/', import.meta.url), { recursive: true });
  const root = fs.mkdtempSync(new URL('../is/invalid-', import.meta.url));
  try {
    fs.writeFileSync(path.join(root, '.mcp.json'), '{');
    assert.equal(main(['--no-user'], {
      cwd: root, home: root, env: {},
      stdout: { write: () => {} }, stderr: { write: () => {} },
    }), 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('escaped server names have source line locations', () => {
  const config = { mcpServers: { 'quoted"name\\test': { url: 'http://example.com' } } };
  const text = JSON.stringify(config, null, 2);
  assert.equal(extractServers(config, 'config.json', text)[0].line, 3);
  assert.equal(auditText(text, 'config.json').findings[0].line, 3);
});
