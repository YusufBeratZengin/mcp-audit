import { stripJsonc } from './jsonc.mjs';

/**
 * One tool definition inside an MCP server or manifest.
 * @typedef {object} Tool
 * @property {string} name Tool name.
 * @property {string | undefined} [description] Tool description/instructions.
 * @property {Record<string, unknown> | undefined} [inputSchema] Tool input schema.
 * @property {string[]} [permissions] Tool-level permissions or scopes, if any.
 * @property {number} [line] 1-based line of the tool definition (0 if unknown).
 * @property {Record<string, unknown>} [raw] Raw tool object.
 */

/**
 * One prompt message definition.
 * @typedef {object} PromptMessage
 * @property {string} role Message role (user, assistant, system).
 * @property {string} content Message content text.
 */

/**
 * One prompt definition inside an MCP server or manifest.
 * @typedef {object} Prompt
 * @property {string} name Prompt name.
 * @property {string | undefined} [description] Prompt description.
 * @property {PromptMessage[]} [messages] Prompt messages.
 * @property {number} [line] 1-based line of the prompt definition (0 if unknown).
 */

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
 * @property {string[]} [permissions] Declared permissions / scopes on the server.
 * @property {Tool[]} [tools] Tool definitions declared on this server.
 * @property {Prompt[]} [prompts] Prompt definitions declared on this server.
 * @property {string | undefined} [description] Server or manifest description.
 * @property {string | undefined} [instructions] Server instructions or prompt guidance.
 * @property {Record<string, unknown>} [raw] Raw server entry object.
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
 * Locate line number for a key or string in stripped JSON text.
 * @param {string} text
 * @param {string} needle
 * @returns {number}
 */
function findLine(text, needle) {
  if (!text || !needle) {return 0;}
  const re = new RegExp(`"${escapeRegExp(needle)}"`, 'g');
  const hit = re.exec(text);
  return hit ? text.slice(0, hit.index).split('\n').length : 0;
}

/**
 * Extract permissions from a server entry or manifest.
 * @param {Record<string, unknown>} entry
 * @returns {string[]}
 */
export function extractPermissions(entry) {
  /** @type {string[]} */
  const perms = [];
  const add = (/** @type {unknown} */ val) => {
    if (typeof val === 'string' && val.trim()) {
      perms.push(val.trim());
    } else if (isObject(val)) {
      if (typeof val.permission === 'string') {
        perms.push(val.permission.trim());
      } else if (typeof val.name === 'string') {
        perms.push(val.name.trim());
      } else if (typeof val.type === 'string') {
        const target = val.host || val.path || val.scope || val.resource || '*';
        perms.push(`${val.type}:${target}`);
      }
    }
  };

  const sources = [
    entry.permissions,
    entry.scopes,
    entry.required_permissions,
    entry.requiredPermissions,
  ];

  for (const src of sources) {
    if (Array.isArray(src)) {
      for (const item of src) {
        add(item);
      }
    } else if (isObject(src)) {
      for (const [key, value] of Object.entries(src)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            perms.push(`${key}:${typeof item === 'string' ? item : '*'}`);
          }
        } else if (typeof value === 'string' || typeof value === 'boolean') {
          perms.push(`${key}:${value}`);
        } else {
          perms.push(key);
        }
      }
    } else if (typeof src === 'string') {
      add(src);
    }
  }

  return perms;
}

/**
 * Extract normalized tool definitions from an entry's tools field.
 * @param {unknown} toolsVal
 * @param {string} [sourceText]
 * @returns {Tool[]}
 */
export function extractTools(toolsVal, sourceText = '') {
  /** @type {Tool[]} */
  const tools = [];
  if (!toolsVal) {return tools;}

  const parseTool = (/** @type {string} */ name, /** @type {unknown} */ item) => {
    if (!isObject(item)) {return;}
    const toolName = typeof item.name === 'string' ? item.name : name;
    const description = typeof item.description === 'string' ? item.description : undefined;
    const schema = item.inputSchema || item.input_schema || item.parameters || item.schema;
    const inputSchema = isObject(schema) ? schema : undefined;
    const permissions = extractPermissions(item);
    const line = findLine(sourceText, toolName);
    tools.push({
      name: toolName,
      description,
      inputSchema,
      permissions,
      line,
      raw: item,
    });
  };

  if (Array.isArray(toolsVal)) {
    for (const item of toolsVal) {
      if (isObject(item)) {
        parseTool(typeof item.name === 'string' ? item.name : 'tool', item);
      }
    }
  } else if (isObject(toolsVal)) {
    for (const [name, item] of Object.entries(toolsVal)) {
      if (isObject(item)) {
        parseTool(name, item);
      }
    }
  }
  return tools;
}

/**
 * Extract normalized prompt definitions from an entry's prompts field.
 * @param {unknown} promptsVal
 * @param {string} [sourceText]
 * @returns {Prompt[]}
 */
export function extractPrompts(promptsVal, sourceText = '') {
  /** @type {Prompt[]} */
  const prompts = [];
  if (!promptsVal) {return prompts;}

  const parsePrompt = (/** @type {string} */ name, /** @type {unknown} */ item) => {
    if (!isObject(item)) {return;}
    const promptName = typeof item.name === 'string' ? item.name : name;
    const description = typeof item.description === 'string' ? item.description : undefined;
    /** @type {PromptMessage[]} */
    const messages = [];
    if (Array.isArray(item.messages)) {
      for (const msg of item.messages) {
        if (isObject(msg)) {
          const role = typeof msg.role === 'string' ? msg.role : 'user';
          const content = typeof msg.content === 'string'
            ? msg.content
            : (isObject(msg.content) && typeof msg.content.text === 'string' ? msg.content.text : '');
          messages.push({ role, content });
        }
      }
    }
    const line = findLine(sourceText, promptName);
    prompts.push({
      name: promptName,
      description,
      messages,
      line,
    });
  };

  if (Array.isArray(promptsVal)) {
    for (const item of promptsVal) {
      if (isObject(item)) {
        parsePrompt(typeof item.name === 'string' ? item.name : 'prompt', item);
      }
    }
  } else if (isObject(promptsVal)) {
    for (const [name, item] of Object.entries(promptsVal)) {
      if (isObject(item)) {
        parsePrompt(name, item);
      }
    }
  }
  return prompts;
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
        permissions: extractPermissions(entry),
        tools: extractTools(entry.tools, text),
        prompts: extractPrompts(entry.prompts, text),
        description: typeof entry.description === 'string' ? entry.description : undefined,
        instructions: typeof entry.instructions === 'string' ? entry.instructions : undefined,
        raw: entry,
      });
    }
  }

  // If no containers were found, check if root is a standalone server manifest, tool definitions, or prompt list
  if (servers.length === 0) {
    if (isObject(root)) {
      if (isObject(root.manifest)) {
        const m = root.manifest;
        const name = typeof m.name === 'string' ? m.name : 'manifest';
        const line = findLine(text, name) || 1;
        const args = Array.isArray(m.args) ? m.args.filter(a => typeof a === 'string' || typeof a === 'number').map(String) : [];
        servers.push({
          name,
          file,
          scope: 'manifest',
          line,
          command: typeof m.command === 'string' ? m.command : undefined,
          args,
          env: stringMap(m.env),
          url: typeof m.url === 'string' ? m.url : (typeof m.serverUrl === 'string' ? m.serverUrl : undefined),
          headers: stringMap(m.headers),
          transport: typeof m.type === 'string' ? m.type : (typeof m.transport === 'string' ? m.transport : undefined),
          permissions: extractPermissions(m),
          tools: extractTools(m.tools, text),
          prompts: extractPrompts(m.prompts, text),
          description: typeof m.description === 'string' ? m.description : undefined,
          instructions: typeof m.instructions === 'string' ? m.instructions : undefined,
          raw: m,
        });
      } else if (
        Array.isArray(root.tools) || isObject(root.tools)
        || Array.isArray(root.permissions) || Array.isArray(root.scopes) || isObject(root.permissions)
        || isObject(root.capabilities)
        || (typeof root.name === 'string' && (root.tools || root.permissions || root.command || root.url || root.description || root.capabilities))
      ) {
        const name = typeof root.name === 'string' ? root.name : (root.tools ? 'tools' : 'manifest');
        const scope = root.tools && !root.name ? 'tools' : 'manifest';
        const line = findLine(text, name) || 1;
        const args = Array.isArray(root.args) ? root.args.filter(a => typeof a === 'string' || typeof a === 'number').map(String) : [];
        servers.push({
          name,
          file,
          scope,
          line,
          command: typeof root.command === 'string' ? root.command : undefined,
          args,
          env: stringMap(root.env),
          url: typeof root.url === 'string' ? root.url : (typeof root.serverUrl === 'string' ? root.serverUrl : undefined),
          headers: stringMap(root.headers),
          transport: typeof root.type === 'string' ? root.type : (typeof root.transport === 'string' ? root.transport : undefined),
          permissions: extractPermissions(root),
          tools: extractTools(root.tools, text),
          prompts: extractPrompts(root.prompts, text),
          description: typeof root.description === 'string' ? root.description : undefined,
          instructions: typeof root.instructions === 'string' ? root.instructions : undefined,
          raw: root,
        });
      }
    } else if (Array.isArray(root)) {
      const isToolArray = root.length > 0 && root.some(item => isObject(item) && (item.name || item.description || item.inputSchema || item.parameters));
      if (isToolArray) {
        servers.push({
          name: 'tools',
          file,
          scope: 'tools',
          line: 1,
          command: undefined,
          args: [],
          env: {},
          url: undefined,
          headers: {},
          transport: undefined,
          permissions: [],
          tools: extractTools(root, text),
          prompts: [],
          description: undefined,
          instructions: undefined,
          raw: { tools: root },
        });
      }
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
