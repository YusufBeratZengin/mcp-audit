/**
 * @typedef {object} Finding
 * @property {string} ruleId
 * @property {string} ruleName
 * @property {import('./severity.mjs').Severity} severity
 * @property {string} message
 * @property {string} fix
 * @property {string} file
 * @property {number} line 1-based, 0 if unknown.
 * @property {string} server
 * @property {string} scope
 * @property {string | undefined} field
 */
/**
 * @typedef {object} AuditOptions
 * @property {string[]} [paths] Files or directories. Empty means "discover".
 * @property {string} [cwd]
 * @property {string} [home]
 * @property {string} [platform]
 * @property {Record<string, string | undefined>} [env]
 * @property {string[]} [ignore] Rule ids to skip.
 * @property {string[]} [trust] Extra trusted package names or globs.
 * @property {boolean} [user] Include user-level files when discovering (default true).
 */
/**
 * @typedef {object} AuditResult
 * @property {Array<{ path: string, client: string | undefined, servers: number }>} files
 * @property {Finding[]} findings
 * @property {Array<{ file: string, message: string, explicit: boolean }>} errors
 * @property {{ files: number, servers: number, findings: number, bySeverity: Record<string, number> }} summary
 */
/**
 * Run every enabled rule on a config text.
 * @param {string} text Raw file content (JSON or JSONC).
 * @param {string} file Path to show in reports.
 * @param {{ ignore?: string[], trust?: string[] }} [options]
 * @returns {{ servers: number, findings: Finding[] }}
 */
export function auditText(text: string, file: string, options?: {
    ignore?: string[];
    trust?: string[];
}): {
    servers: number;
    findings: Finding[];
};
/**
 * Audit explicit paths or the known config locations.
 * @param {AuditOptions} [options]
 * @returns {AuditResult}
 */
export function audit(options?: AuditOptions): AuditResult;
/**
 * Shorten a path for reports: relative to the base directory with forward
 * slashes, or `~/...` under the home directory.
 * @param {string} file
 * @param {string} cwd
 * @param {string} home
 * @returns {string}
 */
export function display(file: string, cwd: string, home: string): string;
export type Finding = {
    ruleId: string;
    ruleName: string;
    severity: import("./severity.mjs").Severity;
    message: string;
    fix: string;
    file: string;
    /**
     * 1-based, 0 if unknown.
     */
    line: number;
    server: string;
    scope: string;
    field: string | undefined;
};
export type AuditOptions = {
    /**
     * Files or directories. Empty means "discover".
     */
    paths?: string[] | undefined;
    cwd?: string | undefined;
    home?: string | undefined;
    platform?: string | undefined;
    env?: Record<string, string | undefined> | undefined;
    /**
     * Rule ids to skip.
     */
    ignore?: string[] | undefined;
    /**
     * Extra trusted package names or globs.
     */
    trust?: string[] | undefined;
    /**
     * Include user-level files when discovering (default true).
     */
    user?: boolean | undefined;
};
export type AuditResult = {
    files: Array<{
        path: string;
        client: string | undefined;
        servers: number;
    }>;
    findings: Finding[];
    errors: Array<{
        file: string;
        message: string;
        explicit: boolean;
    }>;
    summary: {
        files: number;
        servers: number;
        findings: number;
        bySeverity: Record<string, number>;
    };
};
