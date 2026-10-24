import { packagesOf, resolveLaunch } from '../launch.mjs';
import { globToRegExp } from './util.mjs';

/**
 * Publishers that are commonly used for MCP servers. Matching one of these is
 * a convenience for reducing noise, not a statement that the code is safe.
 */
export const BUILTIN_TRUST = [
  '@modelcontextprotocol/*',
  '@anthropic-ai/*',
  '@playwright/*',
  '@upstash/*',
  '@notionhq/*',
  '@cloudflare/*',
  '@github/*',
  '@azure/*',
  '@microsoft/*',
  '@stripe/*',
  '@sentry/*',
  '@supabase/*',
  'mcp-server-fetch',
  'mcp-server-git',
  'mcp-server-time',
  'mcp/*',
  'ghcr.io/github/*',
];

/**
 * @param {string} name
 * @param {string[]} patterns
 * @returns {boolean}
 */
function trusted(name, patterns) {
  return patterns.some(p => globToRegExp(p).test(name));
}

/** @type {import('./util.mjs').Rule} */
export const provenanceRule = {
  id: 'MCP006',
  name: 'unknown-provenance',
  severity: 'low',
  summary: 'Package comes from a git repository or URL, or from a publisher that is not on the trust list.',
  check(server, ctx) {
    return packagesOf(resolveLaunch(server)).flatMap(ref => {
      if (ref.source === 'local') {
        return [];
      }
      if (ref.source === 'git' || ref.source === 'url') {
        const sha = ref.source === 'git' && /#[0-9a-f]{40}$/i.test(ref.spec);
        return [{
          field: 'args',
          severity: sha ? 'low' : 'medium',
          message: `${ref.runner} installs a package straight from ${ref.source === 'git' ? 'a git repository' : 'a URL'} instead of a registry${sha ? ' (pinned to a commit)' : ''}.`,
          fix: ref.source === 'git' && !sha
            ? 'Pin the git reference to a full commit hash, or publish and install a registry version with integrity checks.'
            : 'Prefer a registry release with an exact version, and review the source before trusting it.',
        }];
      }
      const name = ref.ecosystem === 'pypi' ? ref.name.replace(/\[.*$/, '').toLowerCase() : ref.name;
      if (trusted(name, [...BUILTIN_TRUST, ...ctx.trust])) {
        return [];
      }
      return [{
        field: 'args',
        message: `"${name}" (${ref.ecosystem}) is not on the trust list; check who publishes it and what it can access.`,
        fix: 'Review the package source and maintainers. Once reviewed, add it with --trust "<name or glob>" to silence this note.',
      }];
    });
  },
};
