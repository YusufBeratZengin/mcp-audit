// Library usage: audit a config and print one line per finding.
// Run from the repository root: node examples/api.mjs
import { audit } from 'mcp-audit';

const result = audit({ paths: ['examples/insecure.mcp.json'], ignore: ['MCP006'] });

for (const f of result.findings) {
  console.log(`${f.severity.padEnd(8)} ${f.ruleId} ${f.server}: ${f.message.split(';')[0]}`);
}
console.log(`\n${result.summary.findings} findings in ${result.summary.files} file`);
