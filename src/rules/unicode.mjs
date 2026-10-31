/**
 * MCP008: hidden-unicode
 * Detects zero-width spaces, invisible formatting characters, Bidi overrides (Trojan Source),
 * and Unicode tag characters in MCP server manifests, tool definitions, descriptions and schemas.
 */

/**
 * Map of known suspicious invisible, formatting, and Bidi override Unicode code points.
 * @type {Map<number, string>}
 */
const UNICODE_NAMES = new Map([
  // Zero-width and invisible formatting characters
  [0x200b, 'U+200B (ZERO WIDTH SPACE)'],
  [0x200c, 'U+200C (ZERO WIDTH NON-JOINER)'],
  [0x200d, 'U+200D (ZERO WIDTH JOINER)'],
  [0x2060, 'U+2060 (WORD JOINER)'],
  [0xfeff, 'U+FEFF (ZERO WIDTH NO-BREAK SPACE)'],
  [0x180e, 'U+180E (MONGOLIAN VOWEL SEPARATOR)'],
  [0x200e, 'U+200E (LEFT-TO-RIGHT MARK)'],
  [0x200f, 'U+200F (RIGHT-TO-LEFT MARK)'],
  // Bidirectional text overrides / isolates (Trojan Source)
  [0x202a, 'U+202A (LEFT-TO-RIGHT EMBEDDING)'],
  [0x202b, 'U+202B (RIGHT-TO-LEFT EMBEDDING)'],
  [0x202c, 'U+202C (POP DIRECTIONAL FORMATTING)'],
  [0x202d, 'U+202D (LEFT-TO-RIGHT OVERRIDE)'],
  [0x202e, 'U+202E (RIGHT-TO-LEFT OVERRIDE)'],
  [0x2066, 'U+2066 (LEFT-TO-RIGHT ISOLATE)'],
  [0x2067, 'U+2067 (RIGHT-TO-LEFT ISOLATE)'],
  [0x2068, 'U+2068 (FIRST STRONG ISOLATE)'],
  [0x2069, 'U+2069 (POP DIRECTIONAL ISOLATE)'],
  // Soft hyphens and invisible separators
  [0x00ad, 'U+00AD (SOFT HYPHEN)'],
  [0x2028, 'U+2028 (LINE SEPARATOR)'],
  [0x2029, 'U+2029 (PARAGRAPH SEPARATOR)'],
]);

/**
 * Scan a string for hidden Unicode characters, returning formatted descriptions of findings.
 * @param {string} str
 * @returns {string[]}
 */
export function findHiddenUnicode(str) {
  if (!str || typeof str !== 'string') {
    return [];
  }
  const found = new Set();
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (cp === undefined) {
      continue;
    }
    if (UNICODE_NAMES.has(cp)) {
      found.add(/** @type {string} */ (UNICODE_NAMES.get(cp)));
    } else if (cp >= 0xe0000 && cp <= 0xe007f) {
      // Unicode Tags block (U+E0000 - U+E007F), commonly used for invisible prompt injection
      found.add(`U+${cp.toString(16).toUpperCase()} (UNICODE TAG)`);
    } else if (cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d) {
      // C0 control characters outside basic whitespace (\t, \n, \r)
      found.add(`U+${cp.toString(16).padStart(4, '0').toUpperCase()} (CONTROL CHARACTER)`);
    } else if (cp === 0x7f) {
      found.add('U+007F (DELETE)');
    }
  }
  return [...found];
}

/**
 * Recursively check string values inside an object for hidden Unicode characters.
 * @param {unknown} obj
 * @param {string} prefix
 * @param {number} line
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanObject(obj, prefix, line, hits) {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      if (typeof item === 'string') {
        const chars = findHiddenUnicode(item);
        if (chars.length > 0) {
          hits.push({
            field: `${prefix}[${index}]`,
            line,
            severity: 'high',
            message: `${prefix}[${index}] contains hidden Unicode character ${chars.join(', ')}; invisible characters can conceal instructions from human review.`,
            fix: 'Remove invisible Unicode formatting, zero-width characters and Bidi overrides; use standard printable text.',
          });
        }
      } else if (typeof item === 'object') {
        scanObject(item, `${prefix}[${index}]`, line, hits);
      }
    });
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    const keyChars = findHiddenUnicode(key);
    if (keyChars.length > 0) {
      hits.push({
        field: `${prefix}.${key}`,
        line,
        severity: 'high',
        message: `${prefix} key "${key}" contains hidden Unicode character ${keyChars.join(', ')}; invisible characters can spoof tool or argument names.`,
        fix: 'Remove invisible Unicode formatting from keys and names; use standard printable ASCII characters.',
      });
    }
    if (typeof value === 'string') {
      const valChars = findHiddenUnicode(value);
      if (valChars.length > 0) {
        hits.push({
          field: `${prefix}.${key}`,
          line,
          severity: 'high',
          message: `${prefix}.${key} contains hidden Unicode character ${valChars.join(', ')}; invisible characters can conceal instructions from human review.`,
          fix: 'Remove invisible Unicode formatting, zero-width characters and Bidi overrides; use standard printable text.',
        });
      }
    } else if (typeof value === 'object') {
      scanObject(value, `${prefix}.${key}`, line, hits);
    }
  }
}

/** @type {import('./util.mjs').Rule} */
export const unicodeRule = {
  id: 'MCP008',
  name: 'hidden-unicode',
  severity: 'high',
  summary: 'Tool definition or manifest contains zero-width, invisible formatting or Bidi override characters.',
  check(server) {
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];

    /**
     * @param {unknown} text
     * @param {string} field
     * @param {number} line
     */
    const checkText = (text, field, line) => {
      if (typeof text !== 'string') {return;}
      const chars = findHiddenUnicode(text);
      if (chars.length > 0) {
        hits.push({
          field,
          line,
          severity: 'high',
          message: `${field} contains hidden Unicode character ${chars.join(', ')}; invisible characters can conceal instructions from human review.`,
          fix: 'Remove invisible Unicode formatting, zero-width characters and Bidi overrides; use standard printable text.',
        });
      }
    };

    checkText(server.name, 'name', server.line);
    checkText(server.description, 'description', server.line);
    checkText(server.instructions, 'instructions', server.line);

    for (let i = 0; i < server.args.length; i++) {
      checkText(server.args[i], `args[${i}]`, server.line);
    }

    for (const [key, value] of Object.entries(server.env)) {
      checkText(key, `env.${key}`, server.line);
      checkText(value, `env.${key}`, server.line);
    }

    for (const tool of server.tools ?? []) {
      const toolLine = tool.line ?? server.line;
      checkText(tool.name, `tools[${tool.name}].name`, toolLine);
      checkText(tool.description, `tools[${tool.name}].description`, toolLine);

      if (tool.inputSchema && typeof tool.inputSchema === 'object') {
        scanObject(tool.inputSchema, `tools[${tool.name}].inputSchema`, toolLine, hits);
      }
    }

    for (const prompt of server.prompts ?? []) {
      const promptLine = prompt.line ?? server.line;
      checkText(prompt.name, `prompts[${prompt.name}].name`, promptLine);
      checkText(prompt.description, `prompts[${prompt.name}].description`, promptLine);
      for (const msg of prompt.messages ?? []) {
        checkText(msg.content, `prompts[${prompt.name}].content`, promptLine);
      }
    }

    return hits;
  },
};
