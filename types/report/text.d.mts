/**
 * Human-readable report grouped by file and server.
 * @param {import('../audit.mjs').AuditResult} result
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatText(result: import("../audit.mjs").AuditResult, options?: {
    color?: boolean;
}): string;
