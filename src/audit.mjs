import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discover } from './discover.mjs';
import { parseJsonc } from './jsonc.mjs';
import { extractServers } from './normalize.mjs';
import { RULES } from './rules/index.mjs';
import { rank } from './severity.mjs';
import { maskKnownTokens, scanSecrets } from './rules/secrets.mjs';

/**
 * @typedef {object} Finding
 * @property {string} ruleId
 * @property {string} ruleName
 * @property {import('./severity.mjs').Severity} severity
 * @property {string} message
 * @property {string} fix
 * @property {string} file
 * @property {number} line 1-based, 0 if unknown.
 * @property {string} server
 * @property {string} scope
 * @property {string | undefined} field
 */

/**
 * @typedef {object} AuditOptions
 * @property {string[]} [paths] Files or directories. Empty means "discover".
 * @property {string} [cwd]
 * @property {string} [home]
 * @property {string} [platform]
 * @property {Record<string, string | undefined>} [env]
 * @property {string[]} [ignore] Rule ids to skip.
 * @property {string[]} [trust] Extra trusted package names or globs.
 * @property {boolean} [user] Include user-level files when discovering (default true).
 */

/**
 * @typedef {object} AuditResult
 * @property {Array<{ path: string, client: string | undefined, servers: number }>} files
 * @property {Finding[]} findings
 * @property {Array<{ file: string, message: string, explicit: boolean }>} errors
 * @property {{ files: number, servers: number, findings: number, bySeverity: Record<string, number> }} summary
 */

/**
 * Run every enabled rule on a config text.
 * @param {string} text Raw file content (JSON or JSONC).
 * @param {string} file Path to show in reports.
 * @param {{ ignore?: string[], trust?: string[] }} [options]
 * @returns {{ servers: number, findings: Finding[] }}
 */
export function auditText(text, file, options = {}) {
  const root = parseJsonc(text);
  const servers = extractServers(root, file, text);
  const ignore = new Set((options.ignore ?? []).map(id => id.toUpperCase()));
  const ctx = { trust: options.trust ?? [] };
  /** @type {Finding[]} */
  const findings = [];
  const literals = new Set();
  for (const server of servers) {
    scanSecrets(server, literals);
  }
  const mask = (/** @type {string} */ value) => {
    for (const literal of [...literals].sort((a, b) => b.length - a.length)) {
      value = value.split(literal).join('[REDACTED]');
    }
    return maskKnownTokens(value);
  };
  for (const server of servers) {
    for (const rule of RULES) {
      if (ignore.has(rule.id)) {
        continue;
      }
      for (const hit of rule.check(server, ctx)) {
        findings.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: hit.severity ?? rule.severity,
          message: mask(hit.message),
          fix: mask(hit.fix),
          file,
          line: hit.line ?? server.line,
          server: server.name,
          scope: server.scope,
          field: hit.field,
        });
      }
    }
  }
  return { servers: servers.length, findings };
}

/**
 * Audit explicit paths or the known config locations.
 * @param {AuditOptions} [options]
 * @returns {AuditResult}
 */
export function audit(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const home = options.home ?? os.homedir();
  const paths = options.paths ?? [];
  /** @type {Array<{ path: string, client: string | undefined, explicit: boolean }>} */
  const targets = [];
  const discoverBase = { cwd, home, platform: options.platform, env: options.env };
  if (paths.length === 0) {
    for (const found of discover({ ...discoverBase, user: options.user })) {
      targets.push({ path: found.path, client: found.client, explicit: false });
    }
  }
  for (const given of paths) {
    const resolved = path.resolve(cwd, given);
    let isDir = false;
    try {
      isDir = fs.statSync(resolved).isDirectory();
    } catch {
      // Reported as a read error below.
    }
    if (isDir) {
      for (const found of discover({ ...discoverBase, cwd: resolved, user: false })) {
        targets.push({ path: found.path, client: found.client, explicit: true });
      }
    } else {
      targets.push({ path: resolved, client: undefined, explicit: true });
    }
  }

  /** @type {AuditResult} */
  const result = {
    files: [],
    findings: [],
    errors: [],
    summary: { files: 0, servers: 0, findings: 0, bySeverity: { critical: 0, high: 0, medium: 0, low: 0 } },
  };
  const seen = new Set();
  for (const target of targets) {
    const shown = display(target.path, cwd, home);
    try {
      const real = fs.realpathSync(target.path);
      if (seen.has(real)) {
        continue;
      }
      seen.add(real);
      const text = fs.readFileSync(target.path, 'utf8');
      const { servers, findings } = auditText(text, shown, options);
      result.files.push({ path: shown, client: target.client, servers });
      result.findings.push(...findings);
    } catch (error) {
      // Native JSON errors can quote credentials from the input. Filesystem
      // errors can expose absolute paths. Keep both out of every report.
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
      const message = error instanceof SyntaxError ? 'Invalid JSON/JSONC configuration.' : `Cannot read configuration (${code}).`;
      result.errors.push({ file: shown, message, explicit: target.explicit });
    }
  }
  result.findings.sort((a, b) => result.files.findIndex(f => f.path === a.file) - result.files.findIndex(f => f.path === b.file)
    || a.line - b.line || rank(b.severity) - rank(a.severity) || a.ruleId.localeCompare(b.ruleId));
  result.summary.files = result.files.length;
  result.summary.servers = result.files.reduce((sum, f) => sum + f.servers, 0);
  result.summary.findings = result.findings.length;
  for (const finding of result.findings) {
    result.summary.bySeverity[finding.severity] += 1;
  }
  return result;
}

/**
 * Shorten a path for reports: relative to the base directory with forward
 * slashes, or `~/...` under the home directory.
 * @param {string} file
 * @param {string} cwd
 * @param {string} home
 * @returns {string}
 */
export function display(file, cwd, home) {
  const norm = (/** @type {string} */ p) => p.replace(/\\/g, '/');
  const rel = path.relative(cwd, file);
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
    return norm(rel);
  }
  const fromHome = path.relative(home, file);
  if (fromHome && !fromHome.startsWith('..') && !path.isAbsolute(fromHome)) {
    return `~/${norm(fromHome)}`;
  }
  return norm(file);
}
