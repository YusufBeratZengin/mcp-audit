/**
 * Extract permissions from a server entry or manifest.
 * @param {Record<string, unknown>} entry
 * @returns {string[]}
 */
export function extractPermissions(entry: Record<string, unknown>): string[];
/**
 * Extract normalized tool definitions from an entry's tools field.
 * @param {unknown} toolsVal
 * @param {string} [sourceText]
 * @returns {Tool[]}
 */
export function extractTools(toolsVal: unknown, sourceText?: string): Tool[];
/**
 * Extract normalized prompt definitions from an entry's prompts field.
 * @param {unknown} promptsVal
 * @param {string} [sourceText]
 * @returns {Prompt[]}
 */
export function extractPrompts(promptsVal: unknown, sourceText?: string): Prompt[];
/**
 * Extract normalized servers from a parsed config.
 * @param {unknown} root Parsed JSON.
 * @param {string} file Path used in reports.
 * @param {string} [sourceText] Original text, used to find line numbers.
 * @returns {Server[]}
 */
export function extractServers(root: unknown, file: string, sourceText?: string): Server[];
/**
 * One tool definition inside an MCP server or manifest.
 */
export type Tool = {
    /**
     * Tool name.
     */
    name: string;
    /**
     * Tool description/instructions.
     */
    description?: string | undefined;
    /**
     * Tool input schema.
     */
    inputSchema?: Record<string, unknown> | undefined;
    /**
     * Tool-level permissions or scopes, if any.
     */
    permissions?: string[] | undefined;
    /**
     * 1-based line of the tool definition (0 if unknown).
     */
    line?: number | undefined;
    /**
     * Raw tool object.
     */
    raw?: Record<string, unknown> | undefined;
};
/**
 * One prompt message definition.
 */
export type PromptMessage = {
    /**
     * Message role (user, assistant, system).
     */
    role: string;
    /**
     * Message content text.
     */
    content: string;
};
/**
 * One prompt definition inside an MCP server or manifest.
 */
export type Prompt = {
    /**
     * Prompt name.
     */
    name: string;
    /**
     * Prompt description.
     */
    description?: string | undefined;
    /**
     * Prompt messages.
     */
    messages?: PromptMessage[] | undefined;
    /**
     * 1-based line of the prompt definition (0 if unknown).
     */
    line?: number | undefined;
};
/**
 * One MCP server entry, normalized across client formats.
 */
export type Server = {
    /**
     * Key of the entry in the config.
     */
    name: string;
    /**
     * File the entry was read from.
     */
    file: string;
    /**
     * Where in the file the entry lives, e.g. `mcpServers`.
     */
    scope: string;
    /**
     * 1-based line of the entry key (0 if unknown).
     */
    line: number;
    /**
     * Executable for stdio servers.
     */
    command: string | undefined;
    /**
     * Arguments for the executable.
     */
    args: string[];
    /**
     * Environment variables passed to the server.
     */
    env: Record<string, string>;
    /**
     * Remote endpoint for http / sse servers.
     */
    url: string | undefined;
    /**
     * HTTP headers sent to a remote server.
     */
    headers: Record<string, string>;
    /**
     * Declared `type` / `transport`, if any.
     */
    transport: string | undefined;
    /**
     * Declared permissions / scopes on the server.
     */
    permissions?: string[] | undefined;
    /**
     * Tool definitions declared on this server.
     */
    tools?: Tool[] | undefined;
    /**
     * Prompt definitions declared on this server.
     */
    prompts?: Prompt[] | undefined;
    /**
     * Server or manifest description.
     */
    description?: string | undefined;
    /**
     * Server instructions or prompt guidance.
     */
    instructions?: string | undefined;
    /**
     * Raw server entry object.
     */
    raw?: Record<string, unknown> | undefined;
};
