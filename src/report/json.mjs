import { VERSION } from '../version.mjs';

/**
 * Machine-readable report. Secret values are already redacted in messages.
 * @param {import('../audit.mjs').AuditResult} result
 * @returns {string}
 */
export function formatJson(result) {
  return `${JSON.stringify({
    tool: 'mcp-audit',
    version: VERSION,
    summary: result.summary,
    files: result.files,
    findings: result.findings,
    errors: result.errors.map(({ file, message }) => ({ file, message })),
  }, null, 2)}\n`;
}
