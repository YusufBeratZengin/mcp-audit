// Import tests in one process: portable to Node 20 and restricted environments.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../test/', import.meta.url));
function* files(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* files(full);
    } else if (entry.name.endsWith('.test.mjs')) {
      yield full;
    }
  }
}
// Load every source module so untouched modules count in coverage too.
await import('../src/index.mjs');
await import('../src/cli.mjs');
for (const file of [...files(root)].sort()) {
  await import(pathToFileURL(file).href);
}
