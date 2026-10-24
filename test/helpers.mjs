import { auditText } from '../src/audit.mjs';

/**
 * Audit a config object as if it were `.mcp.json`.
 * @param {Record<string, unknown>} servers Entries of `mcpServers`.
 * @param {{ ignore?: string[], trust?: string[] }} [options]
 */
export function check(servers, options) {
  return auditText(JSON.stringify({ mcpServers: servers }, null, 2), 'test.json', options).findings;
}

/**
 * Rule ids reported for one server entry.
 * @param {Record<string, unknown>} entry
 * @param {{ ignore?: string[], trust?: string[] }} [options]
 * @returns {string[]}
 */
export function ids(entry, options) {
  return check({ s: entry }, options).map(f => f.ruleId);
}

/** Fake credentials, assembled from fragments so no scanner mistakes them for real ones. */
export const fake = {
  github: () => ['gh', 'p_', 'aB3dE6gH9'.repeat(4)].join(''),
  anthropic: () => ['sk', '-ant-', 'Zz9yX8wV7'.repeat(3)].join(''),
  aws: () => ['AK', 'IA', 'ABCDEFGH23456789'].join(''),
  jwt: () => ['ey', 'JhbGciOiJIUzI1NiJ9', '.ey', 'JzdWIiOiJ0ZXN0In0', '.abcdefgh12345'].join(''),
};
