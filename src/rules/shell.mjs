import { packagesOf, resolveLaunch } from '../launch.mjs';

/** Packages whose purpose is to run arbitrary commands for the model. */
const SHELL_PACKAGES = /(mcp-server-commands|mcp-shell|shell-mcp|server-shell|mcp-server-shell|desktop-commander|mcp-terminal|terminal-mcp|mcp-server-terminal|mcp-ssh|ssh-mcp|run-command|command-runner|mcp-bash|bash-mcp|mcp-exec|exec-mcp|shell-server)/i;

/** @type {import('./util.mjs').Rule} */
export const shellRule = {
  id: 'MCP004',
  name: 'shell-execution',
  severity: 'high',
  summary: 'Server is started through a shell interpreter or is a known command-execution server.',
  check(server) {
    const launch = resolveLaunch(server);
    /** @type {import('./util.mjs').Hit[]} */
    const hits = [];
    if (launch.shell?.kind === 'inline') {
      hits.push({
        field: 'command',
        message: `The server is started with ${launch.shell.shell} running a command string, so quoting and injection mistakes become code execution.`,
        fix: 'Call the program directly: set "command" to the executable and put each argument in its own "args" entry.',
      });
    } else if (launch.shell?.kind === 'script') {
      hits.push({
        field: 'command',
        severity: 'medium',
        message: `The server is started through ${launch.shell.shell} running a script; review that script like code.`,
        fix: 'Prefer starting the server executable directly, and keep the wrapper script in the repository where it is reviewed.',
      });
    }
    const refs = packagesOf(launch);
    for (const target of refs.length ? refs.map(ref => ref.name) : [launch.exe]) {
      if (SHELL_PACKAGES.test(target) || SHELL_PACKAGES.test(server.name.replace(/_/g, '-'))) {
        hits.push({
          field: 'args',
          message: `"${SHELL_PACKAGES.test(target) ? target : server.name}" looks like a server that lets the model run commands on your machine.`,
          fix: 'Use it only when you need it, with a command allow-list, and keep human approval on for its tools. Remove it from shared configs.',
        });
      }
    }
    return hits;
  },
};
