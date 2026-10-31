/**
 * Scan a string for hidden Unicode characters, returning formatted descriptions of findings.
 * @param {string} str
 * @returns {string[]}
 */
export function findHiddenUnicode(str: string): string[];
/** @type {import('./util.mjs').Rule} */
export const unicodeRule: import("./util.mjs").Rule;
