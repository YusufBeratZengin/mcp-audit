import { isReference, redact } from './util.mjs';

/**
 * Value shapes that are credentials no matter what the key is called.
 * Prefixes are public, documented formats.
 * @type {Array<{ label: string, re: RegExp }>}
 */
const TOKEN_SHAPES = [
  { label: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { label: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { label: 'OpenAI-style API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/ },
  { label: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { label: 'AWS access key id', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { label: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { label: 'GitLab token', re: /\bglpat-[A-Za-z0-9_-]{20,}/ },
  { label: 'npm token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { label: 'Stripe key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { label: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { label: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/ },
];

/**
 * Mask known credentials echoed by another rule (for example a token supplied
 * where a package name or version was expected).
 * @param {string} text
 * @returns {string}
 */
export function maskKnownTokens(text) {
  for (const { re } of TOKEN_SHAPES) {
    text = text.replace(new RegExp(re.source, 'g'), value => redact(value));
  }
  return text;
}

const SECRET_KEY = /(secret|token|passw(or)?d|passwd|pwd|api[-_]?key|apikey|private[-_]?key|access[-_]?key|credential|auth|bearer|signature|cookie)/i;
const NOT_A_SECRET_KEY = /(_|-)(file|path|url|uri|dir|env|name|host|endpoint|type|mode|enabled|disabled|header)$/i;
const PLACEHOLDER = /^(<[^>]*>|\[[^\]]*\]|your[-_ ].*|xxx+|\*+|changeme|change-me|todo|replace.*|\.\.\.|none|null|undefined|example.*)$/i;

/**
 * Decide whether a literal value assigned to a secret-looking key is a real
 * credential, or something harmless (flag, number, placeholder, reference).
 * @param {string} value
 * @returns {boolean}
 */
function looksLiteral(value) {
  const v = value.trim();
  if (v.length < 6 || isReference(v) || PLACEHOLDER.test(v)) {
    return false;
  }
  return !/^(true|false|yes|no|on|off|\d+)$/i.test(v);
}

/**
 * @param {string} value
 * @returns {string | undefined} Label of the matching token shape.
 */
function shapeOf(value) {
  return TOKEN_SHAPES.find(({ re }) => re.test(value))?.label;
}

/**
 * @param {string} key
 * @returns {boolean}
 */
function secretKey(key) {
  return SECRET_KEY.test(key) && !NOT_A_SECRET_KEY.test(key);
}

/**
 * Scan `key = value` pairs and report secrets.
 * @param {string} where Field prefix, `env` or `headers`.
 * @param {Record<string, string>} pairs
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanPairs(where, pairs, hits) {
  for (const [key, value] of Object.entries(pairs)) {
    const shape = shapeOf(value);
    if (shape) {
      hits.push({
        severity: 'critical',
        field: `${where}.${key}`,
        message: `${where}.${key} holds a literal ${shape}: ${redact(value)}`,
        fix: 'Revoke this credential, then pass it by reference (for example "${' + key + '}" or an input prompt) instead of writing it into the file.',
      });
    } else if (secretKey(key) && looksLiteral(value)) {
      hits.push({
        field: `${where}.${key}`,
        message: `${where}.${key} looks like a secret written in plain text: ${redact(value)}`,
        fix: 'Move the value into your shell environment or a secret manager and reference it, for example "${' + key + '}". Rotate it if the file was ever shared or committed.',
      });
    }
  }
}

/**
 * Scan the argument list for `--token=value`, `--token value` and bare tokens.
 * @param {string[]} args
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanArgs(args, hits) {
  args.forEach((arg, index) => {
    const inline = /^--?([A-Za-z][\w-]*)=([\s\S]+)$/.exec(arg);
    const prevFlag = /^--?([A-Za-z][\w-]*)$/.exec(args[index - 1] ?? '');
    /** @type {[string, string] | undefined} */
    let pair;
    if (inline) {
      pair = [inline[1], inline[2]];
    } else if (prevFlag && !arg.startsWith('-')) {
      pair = [prevFlag[1], arg];
    }
    const shape = shapeOf(arg);
    if (shape) {
      hits.push({
        severity: 'critical',
        field: `args[${index}]`,
        message: `args[${index}] holds a literal ${shape}: ${redact(arg)}`,
        fix: 'Revoke this credential and pass it through an environment variable instead of the command line, where every local user can see it.',
      });
    } else if (pair && secretKey(pair[0]) && looksLiteral(pair[1])) {
      hits.push({
        field: `args[${index}]`,
        message: `args[${index}] passes --${pair[0]} with a literal value: ${redact(pair[1])}`,
        fix: 'Read the value from an environment variable (an env entry with a reference) rather than the argument list.',
      });
    }
  });
}

/**
 * @param {string} url
 * @param {import('./util.mjs').Hit[]} hits
 */
function scanUrl(url, hits) {
  const shape = shapeOf(url);
  if (shape) {
    hits.push({
      severity: 'critical', field: 'url',
      message: `url holds a literal ${shape}: ${redact(url)}`,
      fix: 'Revoke the credential and pass it through a header filled from an environment variable.',
    });
    return;
  }
  const cred = /^[a-z][a-z0-9+.-]*:\/\/([^/\s:@]+):([^/\s@]+)@/i.exec(url);
  if (cred && !isReference(cred[2])) {
    hits.push({
      field: 'url',
      message: `url embeds a username and password: ${redact(cred[2])}`,
      fix: 'Remove credentials from the URL; use an Authorization header filled from an environment variable.',
    });
  }
  const query = /[?&]([A-Za-z_-]*(?:token|key|secret|password|auth|sig)[A-Za-z_-]*)=([^&#\s]+)/i.exec(url);
  if (query && !isReference(query[2])) {
    hits.push({
      field: 'url',
      message: `url carries ${query[1]} as a query parameter: ${redact(query[2])}`,
      fix: 'Send the credential in a header from an environment variable; query strings end up in logs.',
    });
  }
}

/** @type {import('./util.mjs').Rule} */
export const secretsRule = {
  id: 'MCP001',
  name: 'plaintext-secret',
  severity: 'high',
  summary: 'Token, password or API key written in plain text in env, headers, args or url.',
  check(server) {
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];
    scanPairs('env', server.env, hits);
    scanPairs('headers', server.headers, hits);
    scanArgs(server.args, hits);
    for (const arg of server.args) {
      if (/^https?:\/\//i.test(arg) && !shapeOf(arg)) {
        /** @type {import('./util.mjs').Hit[]} */
        const urlHits = [];
        scanUrl(arg, urlHits);
        hits.push(...urlHits.map(hit => ({ ...hit, field: 'args' })));
      }
    }
    if (server.url) {
      scanUrl(server.url, hits);
    }
    return hits;
  },
};
