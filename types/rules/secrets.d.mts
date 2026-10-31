/**
 * Mask known credentials echoed by another rule (for example a token supplied
 * where a package name or version was expected).
 * @param {string} text
 * @returns {string}
 */
export function maskKnownTokens(text: string): string;
/**
 * Scan secrets and optionally collect detected literals for central masking.
 * @param {import('../normalize.mjs').Server} server
 * @param {Set<string>} [literals]
 */
export function scanSecrets(server: import("../normalize.mjs").Server, literals?: Set<string>): import("./util.mjs").Hit[];
/** @type {import('./util.mjs').Rule} */
export const secretsRule: import("./util.mjs").Rule;
