/**
 * Classify the host of a plain (unencrypted) URL.
 * @param {string} url
 * @returns {'local' | 'private' | 'remote'}
 */
export function hostKind(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  } catch {
    return 'remote';
  }
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host);
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0' || (ipv4 && /^127\./.test(host))) {
    return 'local';
  }
  if ((ipv4 && (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host))) || /^(fc|fd)[0-9a-f]{2}:/.test(host)) {
    return 'private';
  }
  return 'remote';
}

/** @type {import('./util.mjs').Rule} */
export const transportRule = {
  id: 'MCP005',
  name: 'insecure-transport',
  severity: 'high',
  summary: 'Remote MCP server reached over http:// or ws:// instead of https:// / wss://.',
  check(server) {
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];
    /** @type {Array<{ field: string, url: string }>} */
    const urls = [];
    if (server.url) {
      urls.push({ field: 'url', url: server.url });
    }
    server.args.forEach((arg, index) => {
      if (/^(http|ws):\/\//i.test(arg)) {
        urls.push({ field: `args[${index}]`, url: arg });
      }
    });
    for (const { field, url } of urls) {
      if (!/^(http|ws):\/\//i.test(url)) {
        continue;
      }
      const kind = hostKind(url);
      if (kind === 'local') {
        continue;
      }
      const scheme = url.slice(0, url.indexOf(':'));
      // Paths and query strings may themselves contain credentials.
      let shown = `${scheme}://[invalid URL]`;
      try {
        shown = `${scheme}://${new URL(url).host}`;
      } catch {
        // Do not echo malformed URLs.
      }
      hits.push({
        field,
        severity: kind === 'private' ? 'low' : 'high',
        message: `${field} uses ${scheme}:// to reach ${kind === 'private' ? 'a private-network host' : 'a remote host'} (${shown}); tokens and tool results travel unencrypted.`,
        fix: `Use ${scheme === 'ws' ? 'wss' : 'https'}:// with a valid certificate${kind === 'private' ? ', or keep the server on localhost behind a tunnel' : ''}.`,
      });
    }
    return hits;
  },
};
