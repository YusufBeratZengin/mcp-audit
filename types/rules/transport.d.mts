/**
 * Classify the host of a plain (unencrypted) URL.
 * @param {string} url
 * @returns {'local' | 'private' | 'remote'}
 */
export function hostKind(url: string): "local" | "private" | "remote";
/** @type {import('./util.mjs').Rule} */
export const transportRule: import("./util.mjs").Rule;
