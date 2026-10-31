/**
 * MCP007: excessive-permissions
 * Checks for wildcard permissions, shell/command execution grants,
 * unrestricted filesystem write access, broad network access, and raw credential access
 * in MCP server manifests and tool definitions.
 */

/** @type {import('./util.mjs').Rule} */
export const permissionsRule = {
  id: 'MCP007',
  name: 'excessive-permissions',
  severity: 'high',
  summary: 'Server manifest or tool requests wildcard, root, shell or broad permissions.',
  check(server) {
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];

    /** @type {Array<{ perm: string, field: string, line: number }>} */
    const entries = [];

    for (const perm of server.permissions ?? []) {
      entries.push({ perm, field: 'permissions', line: server.line });
    }

    for (const tool of server.tools ?? []) {
      for (const perm of tool.permissions ?? []) {
        entries.push({
          perm,
          field: `tools[${tool.name}].permissions`,
          line: tool.line ?? server.line,
        });
      }
    }

    const seen = new Set();

    for (const { perm, field, line } of entries) {
      const lower = perm.toLowerCase().trim();
      const key = `${field}:${lower}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      // 1. Wildcard / unrestricted access
      if (/^(\*|all|full|root|admin|superuser|system:\*|mcp:\*|mcp:admin)$/i.test(lower)) {
        const isCritical = /^(\*|root|superuser)$/i.test(lower);
        hits.push({
          field,
          line,
          severity: isCritical ? 'critical' : 'high',
          message: `${field} requests unrestricted wildcard access ("${perm}"), granting full authority without boundaries.`,
          fix: 'Replace unrestricted permissions with minimal, explicit scopes required for the server tasks.',
        });
        continue;
      }

      // 2. Shell / command execution
      if (/^(shell(:.*)?|exec(:.*)?|terminal(:.*)?|system:exec|command(:.*)?|code:execute|process:spawn|run:command)$/i.test(lower)) {
        hits.push({
          field,
          line,
          severity: 'high',
          message: `${field} grants shell/command execution ("${perm}"), allowing the model to run arbitrary host commands.`,
          fix: 'Restrict the server to predefined safe operations instead of arbitrary command execution.',
        });
        continue;
      }

      // 3. Broad filesystem access
      if (/^(fs|filesystem|file|storage)(:|$)/i.test(lower)) {
        if (/^(fs|filesystem|file|storage):(\*|all|write|full)$/i.test(lower) || lower === 'fs' || lower === 'filesystem') {
          hits.push({
            field,
            line,
            severity: 'high',
            message: `${field} grants unrestricted filesystem write access ("${perm}"), allowing modification of any host file.`,
            fix: 'Restrict filesystem permissions to specific directory paths, and prefer read-only access where possible.',
          });
          continue;
        }

        if (/^(fs|filesystem):read$/i.test(lower)) {
          hits.push({
            field,
            line,
            severity: 'medium',
            message: `${field} grants unconstrained filesystem read access ("${perm}").`,
            fix: 'Limit filesystem read access to explicit project directories.',
          });
          continue;
        }

        const pathMatch = /^(?:fs|filesystem|file|storage):(.*)$/i.exec(lower);
        if (pathMatch) {
          const target = pathMatch[1].trim();
          if (target === '/' || /^[a-z]:\\?$/i.test(target) || target === '/*' || target === '~') {
            hits.push({
              field,
              line,
              severity: target === '~' ? 'medium' : 'high',
              message: `${field} grants filesystem access to root or home directory ("${perm}").`,
              fix: 'Scope filesystem permissions to a dedicated project workspace folder.',
            });
            continue;
          }
        }
      }

      // 4. Broad network access
      if (/^(network|net|http|fetch|socket|internet)(:.*)?$/i.test(lower)) {
        if (/^(network|net|http|fetch|socket|internet):(\*|all)$/i.test(lower) || lower === 'network' || lower === 'net') {
          hits.push({
            field,
            line,
            severity: 'high',
            message: `${field} grants unrestricted outbound network access ("${perm}"), allowing connections to any host.`,
            fix: 'Restrict network permissions to specific domain allow-lists required by the tools.',
          });
          continue;
        }
      }

      // 5. Secrets / credentials access
      if (/^(secrets|credentials|keychain|vault|env|keys)(:.*)?$/i.test(lower)) {
        hits.push({
          field,
          line,
          severity: 'high',
          message: `${field} grants access to host credentials or environment secrets ("${perm}").`,
          fix: 'Avoid granting blanket credential or environment access; pass only specific required variables.',
        });
        continue;
      }
    }

    return hits;
  },
};
