import { VERSION } from '../version.mjs';

const COLORS = { critical: '\u001b[1;35m', high: '\u001b[31m', medium: '\u001b[33m', low: '\u001b[36m' };
const DIM = '\u001b[2m';
const BOLD = '\u001b[1m';
const RESET = '\u001b[0m';
const WIDTH = 100;

/**
 * Greedy word wrap.
 * @param {string} text
 * @param {number} width
 * @returns {string[]}
 */
function wrap(text, width) {
  /** @type {string[]} */
  const out = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) {
      out.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  out.push(line);
  return out;
}

/**
 * Human-readable report grouped by file and server.
 * @param {import('../audit.mjs').AuditResult} result
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatText(result, options = {}) {
  const paint = (/** @type {string} */ code, /** @type {string} */ text) => (options.color ? `${code}${text}${RESET}` : text);
  const lines = [paint(BOLD, `mcp-audit ${VERSION}`), ''];
  for (const file of result.files) {
    const mine = result.findings.filter(f => f.file === file.path);
    lines.push(`${paint(BOLD, file.path)}${file.client ? paint(DIM, `  ${file.client}`) : ''}  ${paint(DIM, `${file.servers} server${file.servers === 1 ? '' : 's'}`)}`);
    if (mine.length === 0) {
      lines.push('  no findings', '');
      continue;
    }
    let lastServer = '';
    for (const f of mine) {
      const group = `${f.scope}/${f.server}`;
      if (group !== lastServer) {
        lines.push(`  ${paint(BOLD, f.server)}${f.line ? paint(DIM, `  line ${f.line}`) : ''}`);
        lastServer = group;
      }
      const head = `    ${f.severity.toUpperCase().padEnd(8)} ${f.ruleId}  `;
      const [first, ...more] = wrap(f.message, WIDTH - head.length);
      lines.push(`    ${paint(COLORS[f.severity], f.severity.toUpperCase().padEnd(8))} ${f.ruleId}  ${first}`);
      for (const line of more) {
        lines.push(' '.repeat(head.length) + line);
      }
      for (const line of wrap(`fix: ${f.fix}`, WIDTH - head.length)) {
        lines.push(' '.repeat(head.length) + paint(DIM, line));
      }
    }
    lines.push('');
  }
  for (const error of result.errors) {
    lines.push(`${paint(COLORS.high, 'error')} ${error.file}: ${error.message}`);
  }
  const s = result.summary;
  const parts = ['critical', 'high', 'medium', 'low'].filter(k => s.bySeverity[k] > 0).map(k => `${s.bySeverity[k]} ${k}`);
  lines.push(s.findings === 0
    ? `No findings in ${s.files} file${s.files === 1 ? '' : 's'} (${s.servers} server${s.servers === 1 ? '' : 's'}).`
    : `${s.findings} finding${s.findings === 1 ? '' : 's'} (${parts.join(', ')}) in ${s.files} file${s.files === 1 ? '' : 's'}, ${s.servers} server${s.servers === 1 ? '' : 's'}.`);
  return `${lines.join('\n')}\n`;
}
