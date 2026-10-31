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
export function isReference(value) {
  return /\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|%[A-Za-z_][A-Za-z0-9_]*%/.test(value);
}

/**
 * Mask a secret so reports never contain it: first two characters and length.
 * @param {string} value
 * @returns {string}
 */
export function redact(value) {
  const shown = value.length > 8 ? value.slice(0, 2) : '';
  return `${shown}*** (${value.length} chars)`;
}

/**
 * Turn a glob with `*` wildcards into a case-sensitive RegExp.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  const body = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${body}$`);
}
