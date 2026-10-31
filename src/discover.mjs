import fs from 'node:fs';
import path from 'node:path';

/**
 * @typedef {object} Location
 * @property {string} client Client that reads the file.
 * @property {'project' | 'user'} scope
 * @property {string} file Path shown to users, relative to the base directory or home.
 * @property {'documented' | 'believed'} confidence `documented` means the client's own
 *   documentation names this path; `believed` means it is widely used but not verified here.
 */

/**
 * Known config locations. `{cwd}` locations are checked in the project
 * directory, the others in the user's home or application-data directory.
 * @param {string} platform `process.platform` value.
 * @returns {Array<Location & { rel: string[], base: 'cwd' | 'home' | 'appdata' | 'xdg' }>}
 */
export function knownLocations(platform) {
  /** @type {Array<Location & { rel: string[], base: 'cwd' | 'home' | 'appdata' | 'xdg' }>} */
  const list = [
    { client: 'Claude Code (project)', scope: 'project', file: '.mcp.json', rel: ['.mcp.json'], base: 'cwd', confidence: 'documented' },
    { client: 'Cursor (project)', scope: 'project', file: '.cursor/mcp.json', rel: ['.cursor', 'mcp.json'], base: 'cwd', confidence: 'documented' },
    { client: 'VS Code (workspace)', scope: 'project', file: '.vscode/mcp.json', rel: ['.vscode', 'mcp.json'], base: 'cwd', confidence: 'documented' },
    { client: 'MCP Manifest (project)', scope: 'project', file: 'mcp-manifest.json', rel: ['mcp-manifest.json'], base: 'cwd', confidence: 'documented' },
    { client: 'Claude Code (user)', scope: 'user', file: '~/.claude.json', rel: ['.claude.json'], base: 'home', confidence: 'documented' },
    { client: 'Cursor (user)', scope: 'user', file: '~/.cursor/mcp.json', rel: ['.cursor', 'mcp.json'], base: 'home', confidence: 'documented' },
    { client: 'Windsurf (user)', scope: 'user', file: '~/.codeium/windsurf/mcp_config.json', rel: ['.codeium', 'windsurf', 'mcp_config.json'], base: 'home', confidence: 'believed' },
  ];
  if (platform === 'win32') {
    list.push(
      { client: 'Claude Desktop', scope: 'user', file: '%APPDATA%/Claude/claude_desktop_config.json', rel: ['Claude', 'claude_desktop_config.json'], base: 'appdata', confidence: 'documented' },
      { client: 'VS Code (user)', scope: 'user', file: '%APPDATA%/Code/User/mcp.json', rel: ['Code', 'User', 'mcp.json'], base: 'appdata', confidence: 'believed' },
    );
  } else if (platform === 'darwin') {
    list.push(
      { client: 'Claude Desktop', scope: 'user', file: '~/Library/Application Support/Claude/claude_desktop_config.json', rel: ['Library', 'Application Support', 'Claude', 'claude_desktop_config.json'], base: 'home', confidence: 'documented' },
      { client: 'VS Code (user)', scope: 'user', file: '~/Library/Application Support/Code/User/mcp.json', rel: ['Library', 'Application Support', 'Code', 'User', 'mcp.json'], base: 'home', confidence: 'believed' },
    );
  } else {
    list.push(
      { client: 'Claude Desktop (community builds)', scope: 'user', file: '~/.config/Claude/claude_desktop_config.json', rel: ['Claude', 'claude_desktop_config.json'], base: 'xdg', confidence: 'believed' },
      { client: 'VS Code (user)', scope: 'user', file: '~/.config/Code/User/mcp.json', rel: ['Code', 'User', 'mcp.json'], base: 'xdg', confidence: 'believed' },
    );
  }
  return list;
}

/**
 * @typedef {object} DiscoverOptions
 * @property {string} cwd Directory searched for project-level files.
 * @property {string} home Home directory.
 * @property {string} [platform] Defaults to `process.platform`.
 * @property {Record<string, string | undefined>} [env] Defaults to `process.env`.
 * @property {boolean} [project] Look for project files (default true).
 * @property {boolean} [user] Look for user-level files (default true).
 */

/**
 * Existing config files at the known locations.
 * @param {DiscoverOptions} options
 * @returns {Array<{ path: string, client: string, scope: 'project' | 'user', confidence: 'documented' | 'believed' }>}
 */
export function discover(options) {
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  const appData = env.APPDATA || path.join(options.home, 'AppData', 'Roaming');
  const xdg = env.XDG_CONFIG_HOME || path.join(options.home, '.config');
  const bases = { cwd: options.cwd, home: options.home, appdata: appData, xdg };
  const wantProject = options.project !== false;
  const wantUser = options.user !== false;
  /** @type {Array<{ path: string, client: string, scope: 'project' | 'user', confidence: 'documented' | 'believed' }>} */
  const found = [];
  const seen = new Set();
  for (const loc of knownLocations(platform)) {
    if ((loc.scope === 'project' && !wantProject) || (loc.scope === 'user' && !wantUser)) {
      continue;
    }
    const file = path.join(bases[loc.base], ...loc.rel);
    let real;
    try {
      if (!fs.statSync(file).isFile()) {
        continue;
      }
      real = fs.realpathSync(file);
    } catch {
      continue;
    }
    if (!seen.has(real)) {
      seen.add(real);
      found.push({ path: file, client: loc.client, scope: loc.scope, confidence: loc.confidence });
    }
  }
  return found;
}
