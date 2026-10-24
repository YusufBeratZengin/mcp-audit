// Compile against the public package entry point and its shipped declarations.
import { audit, auditText, formatJson, formatSarif, formatText, discover, knownLocations, SEVERITIES, meets, RULES, VERSION } from 'mcp-audit';

const result = audit({ paths: ['example.json'], user: false });
const report: string = formatJson(result) + formatSarif(result) + formatText(result);
const count: number = auditText('{}', 'example.json').servers;
const level: 'low' | 'medium' | 'high' | 'critical' = SEVERITIES[0];
const pass: boolean = meets(level, 'high');
const paths: string[] = discover({ cwd: '.', home: '.' }).map(file => file.path);
const version: string = VERSION;
const rule: string = RULES[0].id;
const client: string = knownLocations('win32')[0].client;

// @ts-expect-error paths must be an array, not a scalar.
audit({ paths: 'example.json' });
// @ts-expect-error raw configuration must be text.
auditText({}, 'example.json');

export { report, count, pass, paths, version, rule, client };
