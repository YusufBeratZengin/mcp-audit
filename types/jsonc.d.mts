/**
 * Remove comments and trailing commas from JSONC text (VS Code and Cursor
 * accept it). Strings are respected. Removed characters become spaces so line
 * and column positions stay identical to the source.
 * @param {string} text
 * @returns {string}
 */
export function stripJsonc(text: string): string;
/**
 * Parse JSON or JSONC (with an optional BOM).
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonc(text: string): unknown;
