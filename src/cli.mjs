import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { audit } from './audit.mjs';
import { formatJson } from './report/json.mjs';
import { formatSarif } from './report/sarif.mjs';
import { formatText } from './report/text.mjs';
import { RULES } from './rules/index.mjs';
import { SEVERITIES, meets } from './severity.mjs';
import { VERSION } from './version.mjs';

export const HELP = `mcp-audit ${VERSION}
Audit MCP server configuration files.

Usage:
  mcp-audit [paths...] [options]

With no paths, mcp-audit checks the known config locations in the current
directory (.mcp.json, .cursor/mcp.json, .vscode/mcp.json) and in your home
(Claude Desktop, Claude Code, Cursor, VS Code, Windsurf). A path can be a
config file or a project directory.

Options:
  -f, --format <fmt>    text (default), json or sarif
      --fail-on <lvl>   exit 1 when a finding is at least low, medium, high
                        (default), critical, or never with "none"
      --ignore <ids>    comma-separated rule ids to skip, e.g. MCP006
      --trust <globs>   comma-separated package names or globs to treat as
                        trusted for MCP006, e.g. "@myorg/*"
      --no-user         do not look at user-level config files
  -o, --output <file>   write the report to a file instead of stdout
      --no-color        disable colors (also honors NO_COLOR)
      --list-rules      print the rules and exit
  -h, --help            show this help
  -v, --version         print the version

Exit codes: 0 ok, 1 findings at or above --fail-on, 2 usage or read error.
`;

/**
 * @typedef {object} Io
 * @property {string} cwd
 * @property {string} home
 * @property {{ write: (text: string) => unknown, isTTY?: boolean }} stdout
 * @property {{ write: (text: string) => unknown }} stderr
 * @property {Record<string, string | undefined>} env
 * @property {string} platform
 */

/**
 * @returns {Io}
 */
function defaultIo() {
  return {
    cwd: process.cwd(),
    home: os.homedir(),
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    platform: process.platform,
  };
}

/**
 * @param {string} value
 * @returns {string[]}
 */
function list(value) {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Parse command-line arguments.
 * @param {string[]} argv
 * @returns {{ error?: string, help?: boolean, version?: boolean, listRules?: boolean, paths: string[],
 *   format: string, failOn: string, ignore: string[], trust: string[], user: boolean, output?: string, color?: boolean }}
 */
export function parseArgs(argv) {
  const opts = { paths: /** @type {string[]} */ ([]), format: 'text', failOn: 'high', ignore: /** @type {string[]} */ ([]), trust: /** @type {string[]} */ ([]), user: true };
  /** @type {{ error?: string, help?: boolean, version?: boolean, listRules?: boolean, output?: string, color?: boolean }} */
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      opts.paths.push(...argv.slice(i + 1));
      break;
    }
    const eq = arg.startsWith('--') ? arg.indexOf('=') : -1;
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (eq !== -1 && ['--help', '--version', '--list-rules', '--no-user', '--no-color', '--color'].includes(name)) {
      return { ...opts, ...flags, error: `${name} does not take a value` };
    }
    /** @returns {string | undefined} */
    const value = () => {
      if (eq !== -1) {
        return arg.slice(eq + 1);
      }
      if (argv[i + 1]?.startsWith('-')) {
        return undefined;
      }
      i++;
      return argv[i];
    };
    switch (name) {
      case '-h': case '--help': flags.help = true; break;
      case '-v': case '--version': flags.version = true; break;
      case '--list-rules': flags.listRules = true; break;
      case '--no-user': opts.user = false; break;
      case '--no-color': flags.color = false; break;
      case '--color': flags.color = true; break;
      case '-f': case '--format': {
        const v = value();
        if (v === undefined || !['text', 'json', 'sarif'].includes(v)) {
          return { ...opts, ...flags, error: `--format must be text, json or sarif (got "${v ?? ''}")` };
        }
        opts.format = v;
        break;
      }
      case '--fail-on': {
        const v = value();
        if (v === undefined || ![...SEVERITIES, 'none'].includes(/** @type {never} */ (v))) {
          return { ...opts, ...flags, error: `--fail-on must be low, medium, high, critical or none (got "${v ?? ''}")` };
        }
        opts.failOn = v;
        break;
      }
      case '--ignore': case '--trust': {
        const v = value();
        if (!v) {
          return { ...opts, ...flags, error: `${name} needs a value` };
        }
        (name === '--ignore' ? opts.ignore : opts.trust).push(...list(v));
        break;
      }
      case '-o': case '--output': {
        const v = value();
        if (!v) {
          return { ...opts, ...flags, error: `${name} needs a file name` };
        }
        flags.output = v;
        break;
      }
      default:
        if (arg.startsWith('-') && arg !== '-') {
          return { ...opts, ...flags, error: `unknown option "${arg}"` };
        }
        opts.paths.push(arg);
    }
  }
  return { ...opts, ...flags };
}

/**
 * Run the CLI.
 * @param {string[]} argv Arguments without node and script path.
 * @param {Partial<Io>} [overrides] Injected streams and environment (tests).
 * @returns {number} Exit code.
 */
export function main(argv, overrides = {}) {
  const io = { ...defaultIo(), ...overrides };
  const args = parseArgs(argv);
  if (args.error) {
    io.stderr.write(`mcp-audit: ${args.error}\nTry "mcp-audit --help".\n`);
    return 2;
  }
  if (args.help) {
    io.stdout.write(HELP);
    return 0;
  }
  if (args.version) {
    io.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (args.listRules) {
    io.stdout.write(RULES.map(r => `${r.id}  ${r.severity.padEnd(8)} ${r.name}\n          ${r.summary}\n`).join(''));
    return 0;
  }
  const result = audit({
    paths: args.paths,
    cwd: io.cwd,
    home: io.home,
    platform: io.platform,
    env: io.env,
    ignore: args.ignore,
    trust: args.trust,
    user: args.user,
  });
  const color = args.color ?? (Boolean(io.stdout.isTTY) && !args.output && io.env.NO_COLOR === undefined);
  const report = args.format === 'json' ? formatJson(result)
    : args.format === 'sarif' ? formatSarif(result)
      : formatText(result, { color });
  if (args.output) {
    try {
      fs.writeFileSync(path.resolve(io.cwd, args.output), report);
    } catch (error) {
      io.stderr.write(`mcp-audit: cannot write ${args.output}: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }
  } else {
    io.stdout.write(report);
  }
  if (result.files.length === 0 && result.errors.length === 0) {
    io.stderr.write('mcp-audit: no MCP config files found. Pass a file or directory, or see "known locations" in the README.\n');
  }
  for (const error of result.errors) {
    if (args.format !== 'text' || args.output) {
      io.stderr.write(`mcp-audit: ${error.file}: ${error.message}\n`);
    }
  }
  if (result.errors.length > 0) {
    return 2;
  }
  return result.findings.some(f => meets(f.severity, args.failOn)) ? 1 : 0;
}
