/**
 * One problem reported by a rule for a single server.
 * @typedef {object} Hit
 * @property {string} message What is wrong. Never contains a secret value.
 * @property {string} fix How to resolve it.
 * @property {import('../severity.mjs').Severity} [severity] Overrides the rule default.
 * @property {string} [field] Where in the entry, e.g. `env.GITHUB_TOKEN`.
 * @property {number} [line] Line number override for this specific finding.
 */
/**
 * @typedef {object} Rule
 * @property {string} id Stable identifier, e.g. `MCP001`.
 * @property {string} name Short kebab-case name.
 * @property {import('../severity.mjs').Severity} severity Default severity.
 * @property {string} summary One-line description (also used in docs and SARIF).
 * @property {(server: import('../normalize.mjs').Server, ctx: { trust: string[] }) => Hit[]} check
 */
/**
 * True when a value delegates to an environment variable or client input
 * (`${VAR}`, `$VAR`, `%VAR%`, `${env:VAR}`, `${input:id}`, `${workspaceFolder}`).
 * @param {string} value
 * @returns {boolean}
 */
export function isReference(value: string): boolean;
/**
 * Mask a secret so reports never contain it: first two characters and length.
 * @param {string} value
 * @returns {string}
 */
export function redact(value: string): string;
/**
 * Turn a glob with `*` wildcards into a case-sensitive RegExp.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob: string): RegExp;
/**
 * One problem reported by a rule for a single server.
 */
export type Hit = {
    /**
     * What is wrong. Never contains a secret value.
     */
    message: string;
    /**
     * How to resolve it.
     */
    fix: string;
    /**
     * Overrides the rule default.
     */
    severity?: import("../severity.mjs").Severity | undefined;
    /**
     * Where in the entry, e.g. `env.GITHUB_TOKEN`.
     */
    field?: string | undefined;
    /**
     * Line number override for this specific finding.
     */
    line?: number | undefined;
};
export type Rule = {
    /**
     * Stable identifier, e.g. `MCP001`.
     */
    id: string;
    /**
     * Short kebab-case name.
     */
    name: string;
    /**
     * Default severity.
     */
    severity: import("../severity.mjs").Severity;
    /**
     * One-line description (also used in docs and SARIF).
     */
    summary: string;
    check: (server: import("../normalize.mjs").Server, ctx: {
        trust: string[];
    }) => Hit[];
};
