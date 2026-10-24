import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { main, parseArgs } from '../src/cli.mjs';
import { RULES } from '../src/rules/index.mjs';
import { formatSarif } from '../src/report/sarif.mjs';
import { fake } from './helpers.mjs';

/**
 * Run the CLI with in-memory streams in a scratch directory.
 * @param {string[]} argv
 * @param {Record<string, string>} [files]
 * @param {{ isTTY?: boolean, env?: Record<string, string> }} [extra]
 */
function run(argv, files = {}, extra = {}) {
  fs.mkdirSync(new URL('../is/', import.meta.url), { recursive: true });
  const root = fs.mkdtempSync(new URL('../is/cli-', import.meta.url));
  fs.mkdirSync(path.join(root, 'home'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), content);
  }
  let out = '';
  let err = '';
  try {
    const code = main(argv, {
      cwd: root,
      home: path.join(root, 'home'),
      platform: 'linux',
      env: extra.env ?? {},
      stdout: { write: text => { out += text; }, isTTY: extra.isTTY },
      stderr: { write: text => { err += text; } },
    });
    return { code, out, err, report: fs.existsSync(path.join(root, 'report.json')) ? fs.readFileSync(path.join(root, 'report.json'), 'utf8') : undefined };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const high = JSON.stringify({ mcpServers: { s: { command: 'node', args: ['/'] } } });
const medium = JSON.stringify({ mcpServers: { s: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] } } });
const clean = JSON.stringify({ mcpServers: { s: { command: 'node', args: ['srv.js'] } } });

test('help, version and rule list', () => {
  assert.match(run(['--help']).out, /Usage:/);
  assert.match(run(['-v']).out, /^\d+\.\d+\.\d+\n$/);
  const rules = run(['--list-rules']).out;
  for (const rule of RULES) {
    assert.ok(rules.includes(rule.id));
  }
});

test('exit code follows --fail-on', () => {
  assert.equal(run(['.mcp.json'], { '.mcp.json': high }).code, 1);
  assert.equal(run(['.mcp.json'], { '.mcp.json': clean }).code, 0);
  assert.equal(run(['.mcp.json'], { '.mcp.json': medium }).code, 0, 'medium is below the default threshold');
  assert.equal(run(['.mcp.json', '--fail-on', 'medium'], { '.mcp.json': medium }).code, 1);
  assert.equal(run(['.mcp.json', '--fail-on=low'], { '.mcp.json': medium }).code, 1);
  assert.equal(run(['.mcp.json', '--fail-on', 'critical'], { '.mcp.json': high }).code, 0);
  assert.equal(run(['.mcp.json', '--fail-on', 'none'], { '.mcp.json': high }).code, 0);
});

test('--ignore and --trust change the result', () => {
  assert.equal(run(['.mcp.json', '--ignore', 'MCP003'], { '.mcp.json': high }).code, 0);
  assert.equal(run(['.mcp.json', '--ignore=MCP003,MCP006'], { '.mcp.json': high }).code, 0);
  const unknown = JSON.stringify({ mcpServers: { s: { command: 'npx', args: ['-y', '@acme/tool@1.0.0'] } } });
  assert.match(run(['.mcp.json'], { '.mcp.json': unknown }).out, /MCP006/);
  assert.doesNotMatch(run(['.mcp.json', '--trust', '@acme/*'], { '.mcp.json': unknown }).out, /MCP006/);
});

test('text output is plain unless color is forced or a TTY is attached', () => {
  const plain = run(['.mcp.json'], { '.mcp.json': high });
  assert.ok(!plain.out.includes('\u001b['));
  assert.match(plain.out, /MCP003/);
  assert.match(plain.out, /fix:/);
  assert.ok(run(['.mcp.json', '--color'], { '.mcp.json': high }).out.includes('\u001b['));
  assert.ok(run(['.mcp.json'], { '.mcp.json': high }, { isTTY: true }).out.includes('\u001b['));
  assert.ok(!run(['.mcp.json'], { '.mcp.json': high }, { isTTY: true, env: { NO_COLOR: '1' } }).out.includes('\u001b['));
  assert.ok(!run(['.mcp.json', '--no-color'], { '.mcp.json': high }, { isTTY: true }).out.includes('\u001b['));
});

test('clean files print a no-findings summary', () => {
  const r = run(['.mcp.json'], { '.mcp.json': clean });
  assert.match(r.out, /no findings/);
  assert.match(r.out, /No findings in 1 file/);
});

test('json and sarif formats', () => {
  const j = JSON.parse(run(['.mcp.json', '-f', 'json'], { '.mcp.json': high }).out);
  assert.equal(j.tool, 'mcp-audit');
  assert.equal(j.findings[0].ruleId, 'MCP003');
  assert.equal(j.summary.bySeverity.high, 1);
  const s = JSON.parse(run(['.mcp.json', '--format=sarif'], { '.mcp.json': high }).out);
  assert.equal(s.version, '2.1.0');
  const [runInfo] = s.runs;
  assert.equal(runInfo.tool.driver.rules.length, RULES.length);
  assert.equal(runInfo.results[0].ruleId, 'MCP003');
  assert.equal(runInfo.results[0].level, 'error');
  assert.equal(runInfo.results[0].locations[0].physicalLocation.region.startLine, 1);
  assert.equal(runInfo.tool.driver.rules[runInfo.results[0].ruleIndex].id, 'MCP003');
});

test('sarif levels map severities and omit unknown lines', () => {
  const result = {
    files: [], errors: [], summary: { files: 0, servers: 0, findings: 0, bySeverity: {} },
    findings: ['critical', 'high', 'medium', 'low'].map(severity => ({
      ruleId: 'MCP001', ruleName: 'n', severity, message: 'm', fix: 'f', file: 'a b.json', line: 0, server: 's', scope: 'mcpServers', field: undefined,
    })),
  };
  const sarif = JSON.parse(formatSarif(/** @type {never} */ (result)));
  assert.deepEqual(sarif.runs[0].results.map((/** @type {{ level: string }} */ r) => r.level), ['error', 'error', 'warning', 'note']);
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region, undefined);
  assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'a%20b.json');
});

test('--output writes a file and keeps stdout empty', () => {
  const r = run(['.mcp.json', '-f', 'json', '-o', 'report.json'], { '.mcp.json': high });
  assert.equal(r.out, '');
  assert.equal(r.code, 1);
  assert.equal(JSON.parse(r.report).findings[0].ruleId, 'MCP003');
  const bad = run(['.mcp.json', '-o', 'no/such/dir/report.txt'], { '.mcp.json': high });
  assert.equal(bad.code, 2);
  assert.match(bad.err, /cannot write/);
});

test('usage errors exit 2', () => {
  for (const argv of [['--nope'], ['-f', 'xml'], ['--fail-on', 'huge'], ['--fail-on'], ['--ignore'], ['--trust', ''], ['-o']]) {
    const r = run(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.err, /mcp-audit:/);
  }
});

test('missing or broken explicit files exit 2; empty discovery exits 0 with a note', () => {
  const missing = run(['nope.json']);
  assert.equal(missing.code, 2);
  assert.match(missing.out, /error nope\.json/);
  assert.equal(run(['bad.json', '-f', 'json'], { 'bad.json': '{' }).code, 2);
  const none = run([]);
  assert.equal(none.code, 0);
  assert.match(none.err, /no MCP config files found/);
});

test('output never contains the secret value', () => {
  const secret = fake.github();
  const cfg = JSON.stringify({ mcpServers: { s: { command: 'node', args: ['srv.js'], env: { GH: secret } } } });
  for (const fmt of ['text', 'json', 'sarif']) {
    const r = run(['.mcp.json', '-f', fmt], { '.mcp.json': cfg });
    assert.ok(!r.out.includes(secret), fmt);
    assert.match(r.out, /MCP001/);
  }
});

test('parseArgs collects paths and repeated options', () => {
  const a = parseArgs(['a.json', '--ignore', 'MCP001', '--ignore=MCP002', 'b.json', '--no-user']);
  assert.deepEqual(a.paths, ['a.json', 'b.json']);
  assert.deepEqual(a.ignore, ['MCP001', 'MCP002']);
  assert.equal(a.user, false);
});
