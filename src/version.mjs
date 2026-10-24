import fs from 'node:fs';

/** Version string from package.json. */
export const VERSION = /** @type {string} */ (
  JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
);

/** Public repository, used in SARIF links. */
export const REPO_URL = 'https://github.com/YusufBeratZengin/mcp-audit';
