/**
 * Find the end of a JSON string literal starting at `start` (the opening quote).
 * @param {string} text
 * @param {number} start
 * @returns {number} index just after the closing quote
 */
function skipString(text, start) {
  let j = start + 1;
  while (j < text.length && text[j] !== '"') {
    j += text[j] === '\\' ? 2 : 1;
  }
  return j + 1;
}

/**
 * Blank out commas that directly precede a closing bracket (outside strings).
 * @param {string} text
 * @returns {string}
 */
function dropTrailingCommas(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === ',' && /^\s*[}\]]/.test(text.slice(i + 1))) {
      out += ' ';
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/**
 * Remove comments and trailing commas from JSONC text (VS Code and Cursor
 * accept it). Strings are respected. Removed characters become spaces so line
 * and column positions stay identical to the source.
 * @param {string} text
 * @returns {string}
 */
export function stripJsonc(text) {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      const end = skipString(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += text.slice(i, stop).replace(/[^\r\n]/g, ' ');
      i = stop;
    } else {
      out += ch;
      i++;
    }
  }
  return dropTrailingCommas(out);
}

/**
 * Parse JSON or JSONC (with an optional BOM).
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonc(text) {
  return JSON.parse(stripJsonc(text.replace(/^﻿/, '')));
}
