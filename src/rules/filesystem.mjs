import path from 'node:path';
import { dockerMounts, resolveLaunch } from '../launch.mjs';

const HOME_ALIASES = new Set([
  '~', '$home', '${home}', '${env:home}', '${userhome}', '${env:userprofile}', '$userprofile', '%userprofile%', '%homepath%', '%homedrive%%homepath%',
]);
const SYSTEM_DIRS = new Set(['/etc', '/root', '/var', '/usr', '/bin', '/sbin', '/boot', '/sys', '/proc', 'c:/windows', 'c:/program files']);
const SENSITIVE = /(^|\/)\.(ssh|aws|gnupg|kube|docker|azure|config\/gcloud|netrc|npmrc|pypirc|git-credentials)(\/|$)/i;

/**
 * @typedef {{ level: 'root' | 'home' | 'system' | 'sensitive', why: string }} Verdict
 */

/**
 * Judge one path string. Returns `undefined` for narrow, project-like paths.
 * @param {string} raw
 * @returns {Verdict | undefined}
 */
export function judgePath(raw) {
  let p = raw.trim().replace(/^["']|["']$/g, '').replace(/\\/g, '/');
  if (!/^[A-Za-z]:$/.test(p)) {
    p = /^[A-Za-z]:/.test(p) || p.startsWith('//')
      ? path.win32.normalize(p).replace(/\\/g, '/') : path.posix.normalize(p);
  }
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  const lower = p.toLowerCase();
  if (p === '/' || /^[A-Za-z]:$/.test(p) || /^[A-Za-z]:\/$/.test(p) || lower === '/*') {
    return { level: 'root', why: 'the file system root' };
  }
  if (HOME_ALIASES.has(lower) || /^\/home\/[^/]+$/.test(p) || /^\/Users\/[^/]+$/.test(p) || /^[A-Za-z]:\/Users\/[^/]+$/i.test(p)
    || lower === '/home' || lower === '/users' || lower === 'c:/users') {
    return { level: 'home', why: 'your whole home directory' };
  }
  if (SYSTEM_DIRS.has(lower)) {
    return { level: 'system', why: 'a system directory' };
  }
  if (/^(~|\$home|\$\{home\}|%userprofile%|\/home\/[^/]+|\/Users\/[^/]+|[A-Za-z]:\/Users\/[^/]+)\//i.test(p) && SENSITIVE.test(p)) {
    return { level: 'sensitive', why: 'a directory that holds credentials' };
  }
  return undefined;
}

/**
 * Values that may carry a directory: bare path arguments, `--flag=path` values,
 * and env entries whose name suggests a directory list.
 * @param {import('../normalize.mjs').Server} server
 * @param {import('../launch.mjs').Launch} launch
 * @returns {Array<{ field: string, value: string }>}
 */
function candidates(server, launch) {
  /** @type {Array<{ field: string, value: string }>} */
  const out = [];
  server.args.forEach((arg, index) => {
    const eq = /^--?[A-Za-z][\w-]*=(.+)$/.exec(arg);
    const value = eq ? eq[1] : arg;
    if (!value.startsWith('-') && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      out.push({ field: `args[${index}]`, value });
    }
  });
  for (const [key, value] of Object.entries(server.env)) {
    if (/(dir|path|root|folder|allow|workspace)/i.test(key)) {
      for (const part of value.split(/[;,]|:(?![\\/])/)) {
        out.push({ field: `env.${key}`, value: part });
      }
    }
  }
  if (launch.exe === 'docker' || launch.exe === 'podman') {
    for (const source of dockerMounts(launch.args.slice(1))) {
      out.push({ field: 'args', value: source });
    }
  }
  return out;
}

/** @type {import('./util.mjs').Rule} */
export const filesystemRule = {
  id: 'MCP003',
  name: 'broad-filesystem-access',
  severity: 'high',
  summary: 'Server is given the file system root, a home directory, a system directory or a credentials folder.',
  check(server) {
    const launch = resolveLaunch(server);
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];
    const seen = new Set();
    for (const { field, value } of candidates(server, launch)) {
      const verdict = judgePath(value);
      const key = `${field}|${value}`;
      if (!verdict || seen.has(key)) {
        continue;
      }
      seen.add(key);
      hits.push({
        field,
        severity: verdict.level === 'root' || verdict.level === 'system' ? 'high' : 'medium',
        message: `${field} gives the server access to ${verdict.why} ("${value}").`,
        fix: 'Allow only the project folders the server needs, for example "${workspaceFolder}" or an explicit project path, and mount read-only where possible.',
      });
    }
    return hits;
  },
};
