/** @type {import('./util.mjs').Rule} */
export const instructionsRule: import("./util.mjs").Rule;
export type SuspiciousPattern = {
    pattern: RegExp;
    name: string;
    severity: import("../severity.mjs").Severity;
};
