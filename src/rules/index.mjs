import { secretsRule } from './secrets.mjs';
import { unpinnedRule } from './unpinned.mjs';
import { filesystemRule } from './filesystem.mjs';
import { shellRule } from './shell.mjs';
import { transportRule } from './transport.mjs';
import { provenanceRule } from './provenance.mjs';

/** All rules, in id order. Add new rules here and in docs/rules.md. */
export const RULES = [
  secretsRule,
  unpinnedRule,
  filesystemRule,
  shellRule,
  transportRule,
  provenanceRule,
];
