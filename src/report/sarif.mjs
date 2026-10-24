import { RULES } from '../rules/index.mjs';
import { REPO_URL, VERSION } from '../version.mjs';

/**
 * @param {string} severity
 * @returns {'error' | 'warning' | 'note'}
 */
function level(severity) {
  if (severity === 'critical' || severity === 'high') {
    return 'error';
  }
  return severity === 'medium' ? 'warning' : 'note';
}

/**
 * SARIF 2.1.0 report, for GitHub code scanning and other viewers.
 * @param {import('../audit.mjs').AuditResult} result
 * @returns {string}
 */
export function formatSarif(result) {
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'mcp-audit',
          version: VERSION,
          informationUri: REPO_URL,
          rules: RULES.map(rule => ({
            id: rule.id,
            name: rule.name,
            shortDescription: { text: rule.summary },
            helpUri: `${REPO_URL}/blob/main/docs/rules.md#${rule.id.toLowerCase()}`,
            defaultConfiguration: { level: level(rule.severity) },
          })),
        },
      },
      results: result.findings.map(f => ({
        ruleId: f.ruleId,
        ruleIndex: RULES.findIndex(rule => rule.id === f.ruleId),
        level: level(f.severity),
        message: { text: `${f.message} Fix: ${f.fix}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: encodeURI(f.file) },
            ...(f.line > 0 ? { region: { startLine: f.line } } : {}),
          },
        }],
        properties: { severity: f.severity, server: f.server, field: f.field },
      })),
    }],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}
