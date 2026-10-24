import { stripJsonc } from './jsonc.mjs';

/**
 * One MCP server entry, normalized across client formats.
 * @typedef {object} Server
 * @property {string} name Key of the entry in the config.
 * @property {string} file File the entry was read from.
 * @property {string} scope Where in the file the entry lives, e.g. `mcpServers`.
 * @property {number} line 1-based line of the entry key (0 if unknown).
 * @property {string | undefined} command Executable for stdio servers.
 * @property {string[]} args Arguments for the executable.
 * @property {Record<string, string>} env Environment variables passed to the server.
 * @property {string | undefined} url Remote endpoint for http / sse servers.
 * @property {Record<string, string>} headers HTTP headers sent to a remote server.
 * @property {string | undefined} transport Declared `type` / `transport`, if any.
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Coerce an object of scalars to a string map.
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function stringMap(value) {
  /** @type {Record<string, string>} */
  const out = {};
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
        out[key] = String(item);
      }
    }
  }
  return out;
}

/**
 * Locate server containers in a parsed config. Handles Claude Desktop,
 * Claude Code, Cursor and Windsurf (`mcpServers`), VS Code (`servers`,
 * or `mcp.servers` inside settings.json) and per-project entries inside
 * the Claude Code user file (`projects.<path>.mcpServers`).
 * @param {unknown} root
 * @returns {Array<{ scope: string, servers: Record<string, unknown> }>}
 */
function containers(root) {
  /** @type {Array<{ scope: string, servers: Record<string, unknown> }>} */
  const found = [];
  if (!isObject(root)) {
    return found;
  }
  if (isObject(root.mcpServers)) {
    found.push({ scope: 'mcpServers', servers: root.mcpServers });
  }
  if (isObject(root.servers)) {
    found.push({ scope: 'servers', servers: root.servers });
  }
  if (isObject(root.mcp) && isObject(root.mcp.servers)) {
    found.push({ scope: 'mcp.servers', servers: root.mcp.servers });
  }
  if (isObject(root.projects)) {
    for (const [project, value] of Object.entries(root.projects)) {
      if (isObject(value) && isObject(value.mcpServers)) {
        found.push({ scope: `projects[${project}].mcpServers`, servers: value.mcpServers });
      }
    }
  }
  return found;
}

/**
 * Extract normalized servers from a parsed config.
 * @param {unknown} root Parsed JSON.
 * @param {string} file Path used in reports.
 * @param {string} [sourceText] Original text, used to find line numbers.
 * @returns {Server[]}
 */
export function extractServers(root, file, sourceText = '') {
  const text = stripJsonc(sourceText);
  let cursor = 0;
  /** @type {Server[]} */
  const servers = [];
  for (const { scope, servers: entries } of containers(root)) {
    for (const [name, entry] of Object.entries(entries)) {
      if (!isObject(entry)) {
        continue;
      }
      const key = new RegExp(`${escapeRegExp(JSON.stringify(name))}\\s*:\\s*\\{`, 'g');
      key.lastIndex = cursor;
      let hit = key.exec(text);
      if (!hit) {
        key.lastIndex = 0;
        hit = key.exec(text);
      }
      let line = 0;
      if (hit) {
        cursor = hit.index + 1;
        line = text.slice(0, hit.index).split('\n').length;
      }
      const args = Array.isArray(entry.args) ? entry.args.filter(a => typeof a === 'string' || typeof a === 'number').map(String) : [];
      servers.push({
        name,
        file,
        scope,
        line,
        command: typeof entry.command === 'string' ? entry.command : undefined,
        args,
        env: stringMap(entry.env),
        url: typeof entry.url === 'string' ? entry.url : (typeof entry.serverUrl === 'string' ? entry.serverUrl : undefined),
        headers: stringMap(entry.headers),
        transport: typeof entry.type === 'string' ? entry.type : (typeof entry.transport === 'string' ? entry.transport : undefined),
      });
    }
  }
  return servers;
}

/**
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
