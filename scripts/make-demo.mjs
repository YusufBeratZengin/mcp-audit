// Render docs/demo.svg from the real CLI output for examples/insecure.mcp.json.
// Run with `npm run demo`. A test fails when the committed image is stale.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const COMMAND = '$ mcp-audit examples/insecure.mcp.json';
const COLORS = { CRITICAL: '#d2a8ff', HIGH: '#ff7b72', MEDIUM: '#e3b341', LOW: '#79c0ff' };

/**
 * Capture the CLI output exactly as a user would see it (without colors).
 * @returns {string}
 */
export function captureOutput() {
  let out = '';
  main(['examples/insecure.mcp.json', '--no-color'], {
    cwd: root,
    home: path.join(root, '.tmp-test', 'no-home'),
    env: {},
    stdout: { write: text => { out += text; } },
    stderr: { write: () => { throw new Error('unexpected stderr output'); } },
  });
  return out.trimEnd();
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeXml(text) {
  return text.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch] ?? ch);
}

/**
 * @returns {string}
 */
export function renderDemo() {
  const lines = [COMMAND, '', ...captureOutput().split('\n')];
  const width = Math.max(820, ...lines.map(line => Math.ceil(line.length * 8.4 + 64)));
  const height = 76 + lines.length * 20;
  const rows = lines.map((line, index) => {
    const y = 78 + index * 20;
    const sev = /^(\s+)(CRITICAL|HIGH|MEDIUM|LOW)(\s+)(MCP\d+)(\s+)(.*)$/.exec(line);
    let body;
    if (sev) {
      const [, pad, level, gap, id, gap2, rest] = sev;
      body = `<tspan>${pad}</tspan><tspan fill="${COLORS[/** @type {keyof typeof COLORS} */ (level)]}" font-weight="bold">${level}</tspan><tspan>${gap}${id}${gap2}</tspan><tspan fill="#c9d1d9">${escapeXml(rest)}</tspan>`;
    } else {
      const fill = index === 0 ? '#a5b4fc' : /^\s+fix:/.test(line) ? '#8b949e' : /^\s{20,}\S/.test(line) ? '#8b949e' : /^\d+ finding/.test(line) ? '#e3b341' : '#c9d1d9';
      body = escapeXml(line);
      return `    <text x="28" y="${y}" fill="${fill}" xml:space="preserve">${body}</text>`;
    }
    return `    <text x="28" y="${y}" xml:space="preserve">${body}</text>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
  <title id="t">mcp-audit terminal output</title>
  <desc id="d">Real output of mcp-audit run on examples/insecure.mcp.json: six findings across plaintext secrets, unpinned packages, file system root access, shell execution and an http remote server.</desc>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="12" fill="#0d1117" stroke="#30363d"/>
  <circle cx="26" cy="24" r="6" fill="#ff5f57"/><circle cx="46" cy="24" r="6" fill="#febc2e"/><circle cx="66" cy="24" r="6" fill="#28c840"/>
  <g font-family="ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace" font-size="14">
${rows}
  </g>
</svg>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'demo.svg'), renderDemo());
  console.log('wrote docs/demo.svg');
}
