/**
 * @typedef {{ level: 'root' | 'home' | 'system' | 'sensitive', why: string }} Verdict
 */
/**
 * Judge one path string. Returns `undefined` for narrow, project-like paths.
 * @param {string} raw
 * @returns {Verdict | undefined}
 */
export function judgePath(raw: string): Verdict | undefined;
/** @type {import('./util.mjs').Rule} */
export const filesystemRule: import("./util.mjs").Rule;
export type Verdict = {
    level: "root" | "home" | "system" | "sensitive";
    why: string;
};
