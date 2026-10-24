/**
 * Machine-readable report. Secret values are already redacted in messages.
 * @param {import('../audit.mjs').AuditResult} result
 * @returns {string}
 */
export function formatJson(result: import("../audit.mjs").AuditResult): string;
