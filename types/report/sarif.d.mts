/**
 * SARIF 2.1.0 report, for GitHub code scanning and other viewers.
 * @param {import('../audit.mjs').AuditResult} result
 * @returns {string}
 */
export function formatSarif(result: import("../audit.mjs").AuditResult): string;
