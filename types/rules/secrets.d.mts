/**
 * Mask known credentials echoed by another rule (for example a token supplied
 * where a package name or version was expected).
 * @param {string} text
 * @returns {string}
 */
export function maskKnownTokens(text: string): string;
/** @type {import('./util.mjs').Rule} */
export const secretsRule: import("./util.mjs").Rule;
