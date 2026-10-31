/**
 * MCP007: excessive-permissions
 * Checks for wildcard permissions, shell/command execution grants,
 * unrestricted filesystem write access, broad network access, and raw credential access
 * in MCP server manifests and tool definitions.
 */
/** @type {import('./util.mjs').Rule} */
export const permissionsRule: import("./util.mjs").Rule;
