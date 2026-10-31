/**
 * MCP009: suspicious-instructions
 * Detects prompt injection, instruction overrides, system role hijacking, covert execution directives,
 * and data exfiltration commands in MCP tool descriptions, parameter schemas, instructions and prompts.
 */

/**
 * @typedef {object} SuspiciousPattern
 * @property {RegExp} pattern
 * @property {string} name
 * @property {import('../severity.mjs').Severity} severity
 */

/** @type {SuspiciousPattern[]} */
const SUSPICIOUS_PATTERNS = [
  // 1. Instruction override / reset
  {
    pattern: /(?:ignore|disregard|forget|override|bypass)\s+(?:all\s+)?(?:previous|prior|above|system|existing)\s+(?:instructions?|directives?|rules?|prompts?|constraints?)/i,
    name: 'instruction override',
    severity: 'critical',
  },
  {
    pattern: /(?:new|updated)\s+system\s+(?:prompt|instructions?|directive)/i,
    name: 'system prompt override',
    severity: 'high',
  },
  {
    pattern: /(?:stop|cease)\s+following\s+(?:previous|all)\s+instructions/i,
    name: 'instruction disregard',
    severity: 'high',
  },
  // 2. System prompt & role hijacking
  {
    pattern: /<\/?(?:system|instructions?|admin|override|developer_mode|jailbreak)>/i,
    name: 'fake system tag injection',
    severity: 'high',
  },
  {
    pattern: /(?:^|\n)\s*system\s*:\s*(?:you\s+are|override|new\s+instructions?|disregard)/i,
    name: 'system role prefix injection',
    severity: 'high',
  },
  {
    pattern: /(?:you\s+are\s+now|act\s+as|roleplay\s+as)\s+(?:an?\s+)?(?:unrestricted|jailbroken|evil|dan|developer|root|admin|unfiltered)\b/i,
    name: 'role hijacking / jailbreak persona',
    severity: 'high',
  },
  // 3. Concealment / evasion directives
  {
    pattern: /(?:do\s+not|never)\s+(?:tell|inform|alert|warn|show|notify|reveal\s+to)\s+(?:the\s+)?user/i,
    name: 'covert evasion (do not tell user)',
    severity: 'high',
  },
  {
    pattern: /(?:silently|secretly|covertly)\s+(?:execute|run|send|exfiltrate|fetch|transfer|upload|write|read)\b/i,
    name: 'covert action directive',
    severity: 'high',
  },
  {
    pattern: /(?:hide|conceal)\s+(?:this|the\s+output|the\s+command|these\s+actions?|this\s+call)\s+from\s+(?:the\s+user|the\s+human)/i,
    name: 'covert output concealment',
    severity: 'high',
  },
  {
    pattern: /without\s+(?:the\s+user(?:'s)?\s+(?:knowledge|consent|awareness)|informing\s+(?:the\s+)?user|asking\s+(?:the\s+)?user)/i,
    name: 'unauthorized covert operation directive',
    severity: 'high',
  },
  // 4. Data exfiltration directives
  {
    pattern: /(?:exfiltrate|send|leak|post|upload|transmit)\s+(?:all\s+)?(?:the\s+)?(?:passwords?|keys?|tokens?|credentials?|secrets?|\.env|ssh\s+keys?|private\s+keys?|auth)\s+to/i,
    name: 'credential exfiltration directive',
    severity: 'critical',
  },
  // 5. Guardrail / security bypass
  {
    pattern: /(?:bypass|disable|ignore|turn\s+off|circumvent)\s+(?:all\s+)?(?:security|safety|guardrails?|filters?|restrictions?|policies|protections?)/i,
    name: 'safety guardrail bypass directive',
    severity: 'high',
  },
  // 6. Hidden HTML/Markdown comment directives
  {
    pattern: /<!--\s*(?:system|instruction|prompt|override|ignore|exfiltrate)[^>]*-->/i,
    name: 'hidden HTML comment directive',
    severity: 'high',
  },
];

/**
 * Scan text against suspicious instruction patterns.
 * @param {string} text
 * @param {string} field
 * @param {number} line
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanText(text, field, line, hits) {
  if (typeof text !== 'string') {
    return;
  }
  for (const { pattern, name, severity } of SUSPICIOUS_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      hits.push({
        field,
        line,
        severity,
        message: `${field} contains suspicious instruction text (${name}: "${match[0]}"); tool descriptions should not attempt to steer model behavior.`,
        fix: 'Remove adversarial instructions and prompt injection phrases; keep tool descriptions focused solely on explaining functionality.',
      });
    }
  }
}

/**
 * Recursively check string values inside an object (such as inputSchema) for suspicious instructions.
 * @param {unknown} obj
 * @param {string} prefix
 * @param {number} line
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanSchema(obj, prefix, line, hits) {
  if (!obj || typeof obj !== 'object') {
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      if (typeof item === 'string') {
        scanText(item, `${prefix}[${index}]`, line, hits);
      } else if (typeof item === 'object') {
        scanSchema(item, `${prefix}[${index}]`, line, hits);
      }
    });
    return;
  }
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      if (key === 'description' || key === 'title' || key === 'default') {
        scanText(value, `${prefix}.${key}`, line, hits);
      }
    } else if (typeof value === 'object') {
      scanSchema(value, `${prefix}.${key}`, line, hits);
    }
  }
}

/** @type {import('./util.mjs').Rule} */
export const instructionsRule = {
  id: 'MCP009',
  name: 'suspicious-instructions',
  severity: 'high',
  summary: 'Tool description or prompt metadata contains prompt injection, jailbreak or instruction hijacking phrases.',
  check(server) {
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];

    if (server.description) {
      scanText(server.description, 'description', server.line, hits);
    }
    if (server.instructions) {
      scanText(server.instructions, 'instructions', server.line, hits);
    }

    for (const tool of server.tools ?? []) {
      const toolLine = tool.line ?? server.line;
      if (tool.description) {
        scanText(tool.description, `tools[${tool.name}].description`, toolLine, hits);
      }
      if (tool.inputSchema) {
        scanSchema(tool.inputSchema, `tools[${tool.name}].inputSchema`, toolLine, hits);
      }
    }

    for (const prompt of server.prompts ?? []) {
      const promptLine = prompt.line ?? server.line;
      if (prompt.description) {
        scanText(prompt.description, `prompts[${prompt.name}].description`, promptLine, hits);
      }
      for (const msg of prompt.messages ?? []) {
        if (msg.content) {
          scanText(msg.content, `prompts[${prompt.name}].content`, promptLine, hits);
        }
      }
    }

    return hits;
  },
};
