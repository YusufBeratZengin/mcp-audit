import assert from 'node:assert/strict';
import test from 'node:test';
import { auditText, formatJson, formatSarif, formatText } from '../src/index.mjs';
import { check } from './helpers.mjs';

test('MCP001 scans every URL query parameter, including encoded and repeated names', () => {
  const query = 'token=${TOKEN}&%61pi_key=DEMO_ONLY_FIRST&token=DEMO_ONLY_SECOND';
  for (const entry of [
    { url: `https://example.com/mcp?${query}` },
    { command: 'node', args: [`https://example.com/mcp?${query}`] },
  ]) {
    const hits = check({ demo: entry }).filter(hit => hit.ruleId === 'MCP001');
    assert.equal(hits.length, 2);
    assert.ok(hits.every(hit => hit.severity === 'high'));
    assert.ok(hits.some(hit => hit.message.includes('api_key')));
  }
});

test('MCP001 ignores encoded references, empty queries and fragment-only credentials', () => {
  for (const suffix of [
    '?token=%24%7BTOKEN%7D', '?token=%24TOKEN', '?token=%25TOKEN%25',
    '?token=&page=2', '#?token=DEMO_ONLY_VALUE', '?page=2#&token=DEMO_ONLY_VALUE',
    '?', '?token', '?page=%ZZ',
  ]) {
    assert.equal(check({ demo: { url: `https://example.com/mcp${suffix}` } }).length, 0, suffix);
  }
});

test('decoded and encoded query secrets are masked across all reports when MCP001 is ignored', () => {
  const literal = ['DEMO', 'ONLY', 'VALUE'].join(' ');
  const encoded = encodeURIComponent(literal);
  for (const value of [literal, encoded, literal.replaceAll(' ', '+')]) {
    for (const ignore of [[], ['MCP001']]) {
      const { servers, findings } = auditText(JSON.stringify({ mcpServers: { demo: {
        url: `https://example.com/mcp?token=${value}`,
        command: 'npx', args: [literal, '-p', value],
      } } }), 'config.json', { ignore });
      assert.ok(findings.some(hit => hit.ruleId === 'MCP006'));
      const result = { files: [{ path: 'config.json', servers }], findings, errors: [],
        summary: { files: 1, servers, findings: findings.length, bySeverity: {} } };
      for (const format of [formatJson, formatSarif, formatText]) {
        for (const secret of [literal, value]) {
          assert.ok(!format(result).includes(secret));
        }
      }
    }
  }
});
