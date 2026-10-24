import assert from 'node:assert/strict';
import test from 'node:test';
import { judgePath } from '../src/rules/filesystem.mjs';
import { hostKind } from '../src/rules/transport.mjs';
import { check, fake, ids } from './helpers.mjs';

const npx = (/** @type {string[]} */ ...args) => ({ command: 'npx', args });

test('MCP001 plaintext secrets', async t => {
  await t.test('known token shapes are critical and never printed', () => {
    for (const value of [fake.github(), fake.anthropic(), fake.aws(), fake.jwt()]) {
      const [f] = check({ s: { command: 'x', env: { SOMETHING: value } } });
      assert.equal(f.ruleId, 'MCP001');
      assert.equal(f.severity, 'critical');
      assert.ok(!f.message.includes(value), 'value must be redacted');
    }
  });
  await t.test('secret-looking key with a literal value is high', () => {
    const [f] = check({ s: { command: 'x', env: { MY_API_KEY: 'hunter2-fake-value' } } });
    assert.equal(f.severity, 'high');
    assert.match(f.message, /env\.MY_API_KEY/);
    assert.ok(!f.message.includes('hunter2'));
  });
  await t.test('references, placeholders and non-secrets are fine', () => {
    for (const [key, value] of Object.entries({
      GITHUB_TOKEN: '${GITHUB_TOKEN}',
      API_KEY: '$API_KEY',
      WIN_TOKEN: '%MY_TOKEN%',
      VS_TOKEN: '${input:token}',
      PASSWORD: '<your-password>',
      OTHER_SECRET: 'changeme',
      AUTH_ENABLED: 'true',
      TOKEN_FILE: '/run/secrets/token-file',
      API_KEY_PATH: 'C:/keys/api.txt',
      DEBUG: 'verbose-logging',
      SHORT_TOKEN: 'abc',
      AUTH_COUNT: '123456789',
    })) {
      assert.deepEqual(ids({ command: 'x', env: { [key]: value } }), [], `${key}=${value}`);
    }
  });
  await t.test('headers', () => {
    assert.deepEqual(ids({ url: 'https://h', headers: { Authorization: 'Bearer abcdef123456' } }), ['MCP001']);
    assert.deepEqual(ids({ url: 'https://h', headers: { Authorization: 'Bearer ${input:tok}' } }), []);
    assert.deepEqual(ids({ url: 'https://h', headers: { 'X-Note': fake.github() } }), ['MCP001']);
  });
  await t.test('arguments', () => {
    assert.deepEqual(ids({ command: 'x', args: ['--api-key=abcdef123456'] }), ['MCP001']);
    assert.deepEqual(ids({ command: 'x', args: ['--token', 'abcdef123456'] }), ['MCP001']);
    assert.deepEqual(ids({ command: 'x', args: [fake.anthropic()] }), ['MCP001']);
    assert.deepEqual(ids({ command: 'x', args: ['--token', '${TOKEN}'] }), []);
    assert.deepEqual(ids({ command: 'x', args: ['--verbose', 'abcdef123456'] }), []);
  });
  await t.test('url credentials and query tokens', () => {
    assert.deepEqual(ids({ url: 'https://user:s3cretpw@host/x' }), ['MCP001']);
    assert.deepEqual(ids({ url: 'https://host/x?api_key=abcdef123456' }), ['MCP001']);
    assert.deepEqual(ids({ url: 'https://host/x?api_key=${KEY}' }), []);
    assert.deepEqual(ids({ url: 'https://host/x?page=2' }), []);
  });
});

test('MCP002 unpinned packages', async t => {
  await t.test('flags missing, latest and range versions', () => {
    assert.deepEqual(ids(npx('-y', 'srv'), { ignore: ['MCP006'] }), ['MCP002']);
    assert.deepEqual(ids(npx('-y', 'srv@latest'), { ignore: ['MCP006'] }), ['MCP002']);
    assert.deepEqual(ids(npx('srv@^1.0.0'), { ignore: ['MCP006'] }), ['MCP002']);
    assert.deepEqual(ids({ command: 'uvx', args: ['srv@latest'] }, { ignore: ['MCP006'] }), ['MCP002']);
    assert.deepEqual(ids({ command: 'uvx', args: ['srv'] }, { ignore: ['MCP006'] }), ['MCP002']);
    assert.deepEqual(ids({ command: 'docker', args: ['run', '-i', 'org/img'] }, { ignore: ['MCP006'] }), ['MCP002']);
  });
  await t.test('exact versions are fine', () => {
    assert.deepEqual(ids(npx('-y', 'srv@1.2.3'), { ignore: ['MCP006'] }), []);
    assert.deepEqual(ids({ command: 'uvx', args: ['srv==1.2.3'] }, { ignore: ['MCP006'] }), []);
    assert.deepEqual(ids({ command: 'docker', args: ['run', 'org/img@sha256:0123'] }, { ignore: ['MCP006'] }), []);
  });
  await t.test('message names the problem', () => {
    const [f] = check({ s: { command: 'docker', args: ['run', 'org/img:latest'] } }).filter(x => x.ruleId === 'MCP002');
    assert.match(f.message, /"latest" tag/);
    assert.match(f.fix, /digest/);
    const [g] = check({ s: npx('srv@latest') }).filter(x => x.ruleId === 'MCP002');
    assert.match(g.message, /moving version "latest"/);
  });
  await t.test('Windows cmd /c wrapper is looked through', () => {
    assert.deepEqual(ids({ command: 'cmd', args: ['/c', 'npx', '-y', 'srv'] }, { ignore: ['MCP006'] }), ['MCP002']);
  });
  await t.test('local scripts and plain commands are not packages', () => {
    assert.deepEqual(ids({ command: 'node', args: ['server.js'] }), []);
    assert.deepEqual(ids(npx('./local-server')), []);
  });
});

test('MCP003 broad file system access', async t => {
  await t.test('roots and home directories', () => {
    for (const arg of ['/', 'C:\\', 'C:/', 'D:', '~', '$HOME', '${HOME}', '%USERPROFILE%', '/home/someone', '/Users/someone', 'C:\\Users\\someone', '/etc']) {
      assert.ok(ids({ command: 'node', args: ['srv.js', arg] }).includes('MCP003'), arg);
    }
  });
  await t.test('severity: root and system high, home medium', () => {
    const sev = (/** @type {string} */ arg) => check({ s: { command: 'node', args: [arg] } })[0].severity;
    assert.equal(sev('/'), 'high');
    assert.equal(sev('/etc'), 'high');
    assert.equal(sev('~'), 'medium');
  });
  await t.test('credential directories under home', () => {
    assert.ok(ids({ command: 'node', args: ['~/.ssh'] }).includes('MCP003'));
    assert.ok(ids({ command: 'node', args: ['C:\\Users\\someone\\.aws\\'] }).includes('MCP003'));
  });
  await t.test('narrow paths, flags and urls are fine', () => {
    for (const arg of ['/srv/project', '~/projects/app', '${workspaceFolder}', 'C:\\work\\app', '-y', '/c', 'https://x/']) {
      assert.deepEqual(ids({ command: 'node', args: [arg] }), [], arg);
    }
  });
  await t.test('flag values, env lists and docker mounts', () => {
    assert.ok(ids({ command: 'node', args: ['--root=/'] }).includes('MCP003'));
    assert.ok(ids({ command: 'node', args: [], env: { ALLOWED_DIRECTORIES: '/tmp/a;~' } }).includes('MCP003'));
    assert.ok(ids({ command: 'docker', args: ['run', '-v', '/:/host', 'img@sha256:ab'] }).includes('MCP003'));
    assert.ok(!ids({ command: 'docker', args: ['run', '-v', '/srv/app:/app', 'img@sha256:ab'] }).includes('MCP003'));
  });
  await t.test('duplicates are reported once', () => {
    const hits = check({ s: { command: 'node', args: ['/', '/'] } }).filter(f => f.ruleId === 'MCP003');
    assert.equal(hits.length, 2);
  });
  await t.test('judgePath normalizes quotes and trailing slashes', () => {
    assert.equal(judgePath('"/"')?.level, 'root');
    assert.equal(judgePath('/home/someone/')?.level, 'home');
    assert.equal(judgePath('/home/someone/work'), undefined);
  });
});

test('MCP004 shell execution', async t => {
  await t.test('shell command strings are high', () => {
    for (const entry of [
      { command: 'bash', args: ['-c', 'run-server'] },
      { command: 'sh', args: ['-c', 'run-server'] },
      { command: 'cmd', args: ['/c', 'run-server --stdio'] },
      { command: 'powershell', args: ['-Command', 'Run-Server'] },
    ]) {
      const [f] = check({ s: entry }).filter(x => x.ruleId === 'MCP004');
      assert.equal(f.severity, 'high', JSON.stringify(entry));
    }
  });
  await t.test('shell scripts are medium', () => {
    const [f] = check({ s: { command: 'bash', args: ['start.sh'] } }).filter(x => x.ruleId === 'MCP004');
    assert.equal(f.severity, 'medium');
  });
  await t.test('Windows npx wrapper with separate args is not a shell finding', () => {
    assert.ok(!ids({ command: 'cmd', args: ['/c', 'npx', '-y', 'srv@1.0.0'] }).includes('MCP004'));
  });
  await t.test('known command-execution servers', () => {
    assert.ok(ids(npx('-y', '@wonderwhy-er/desktop-commander@1.0.0')).includes('MCP004'));
    assert.ok(ids({ command: 'uvx', args: ['mcp-server-commands==1.0'] }).includes('MCP004'));
    const named = ids({ command: 'node', args: ['x.js'] });
    assert.ok(!named.includes('MCP004'));
    const [f] = check({ shell_mcp: { command: 'node', args: ['x.js'] } });
    assert.equal(f.ruleId, 'MCP004');
  });
});

test('MCP005 insecure transport', async t => {
  await t.test('remote http and ws are high', () => {
    assert.equal(check({ s: { url: 'http://mcp.example.com/sse' } })[0].severity, 'high');
    assert.deepEqual(ids({ url: 'ws://mcp.example.com' }), ['MCP005']);
  });
  await t.test('https, wss and localhost are fine', () => {
    for (const url of ['https://h/x', 'wss://h', 'http://localhost:3000/mcp', 'http://127.0.0.1:8080', 'http://[::1]:9/x', 'http://dev.localhost/x', 'http://0.0.0.0:1']) {
      assert.deepEqual(ids({ url }), [], url);
    }
  });
  await t.test('private network addresses are low', () => {
    for (const url of ['http://192.168.1.5/x', 'http://10.0.0.2/x', 'http://172.20.1.1/x']) {
      assert.equal(check({ s: { url } })[0].severity, 'low', url);
    }
  });
  await t.test('urls in args (mcp-remote style) are checked, and credentials are masked', () => {
    const hits = check({ s: { command: 'npx', args: ['-y', 'mcp-remote@1.0.0', 'http://user:pw0123456@mcp.example.com/sse'] } }).filter(f => f.ruleId === 'MCP005');
    assert.equal(hits.length, 1);
    assert.ok(!hits[0].message.includes('pw0123456'));
  });
  await t.test('hostKind classifies', () => {
    assert.equal(hostKind('http://localhost'), 'local');
    assert.equal(hostKind('http://example.org'), 'remote');
    assert.equal(hostKind('http://[fd12::1]/'), 'private');
    assert.equal(hostKind('nonsense'), 'remote');
  });
});

test('MCP006 unknown provenance', async t => {
  await t.test('git and url sources', () => {
    const [a] = check({ s: npx('-y', 'github:someone/repo') }).filter(f => f.ruleId === 'MCP006');
    assert.equal(a.severity, 'medium');
    const sha = '0123456789abcdef0123456789abcdef01234567';
    const [b] = check({ s: npx('-y', `github:someone/repo#${sha}`) }).filter(f => f.ruleId === 'MCP006');
    assert.equal(b.severity, 'low');
    const [c] = check({ s: { command: 'uvx', args: ['https://host/pkg.whl'] } }).filter(f => f.ruleId === 'MCP006');
    assert.equal(c.severity, 'medium');
    assert.match(c.fix, /registry release/);
  });
  await t.test('trusted publishers and --trust globs are quiet', () => {
    assert.deepEqual(ids(npx('-y', '@modelcontextprotocol/server-memory@1.0.0')), []);
    assert.deepEqual(ids({ command: 'uvx', args: ['mcp-server-fetch==1.0.0'] }), []);
    assert.deepEqual(ids(npx('-y', '@myorg/tool@1.0.0'), { trust: ['@myorg/*'] }), []);
    assert.deepEqual(ids({ command: 'docker', args: ['run', 'mcp/fetch:1.0'] }), []);
  });
  await t.test('unknown registry packages are low', () => {
    const [f] = check({ s: npx('-y', 'some-mcp@1.0.0') });
    assert.equal(f.ruleId, 'MCP006');
    assert.equal(f.severity, 'low');
    assert.deepEqual(ids({ command: 'uvx', args: ['Some_Tool[x]==1.0'] }), ['MCP006']);
  });
  await t.test('local paths are ignored', () => {
    assert.deepEqual(ids(npx('./dir')), []);
  });
});

test('--ignore skips a rule, case-insensitively', () => {
  assert.deepEqual(ids({ command: 'x', env: { MY_TOKEN: 'abcdef123456' } }, { ignore: ['mcp001'] }), []);
});
