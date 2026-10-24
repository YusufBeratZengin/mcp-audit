/**
 * Extract normalized servers from a parsed config.
 * @param {unknown} root Parsed JSON.
 * @param {string} file Path used in reports.
 * @param {string} [sourceText] Original text, used to find line numbers.
 * @returns {Server[]}
 */
export function extractServers(root: unknown, file: string, sourceText?: string): Server[];
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
};
