import { packagesOf, resolveLaunch } from '../launch.mjs';

/**
 * @param {import('../launch.mjs').PackageRef} ref
 * @returns {string}
 */
function pinAdvice(ref) {
  if (ref.ecosystem === 'npm') {
    return `Pin an exact version, for example "${ref.name}@<x.y.z>", and update it deliberately.`;
  }
  if (ref.ecosystem === 'pypi') {
    return `Pin an exact version, for example "${ref.name}==<x.y.z>", and update it deliberately.`;
  }
  return `Use an explicit tag or, better, an immutable digest: "${ref.name}@sha256:<digest>".`;
}

/** @type {import('./util.mjs').Rule} */
export const unpinnedRule = {
  id: 'MCP002',
  name: 'unpinned-package',
  severity: 'medium',
  summary: 'Server runs a package or image through npx / uvx / pipx / docker without an exact version.',
  check(server) {
    return packagesOf(resolveLaunch(server)).flatMap(ref => {
      if (ref.source !== 'registry' || ref.pinned) {
        return [];
      }
      const how = ref.version === undefined
        ? 'no version'
        : (ref.ecosystem === 'docker' && ref.version === 'latest' ? 'the "latest" tag' : `the moving version "${ref.version}"`);
      return [{
        field: 'args',
        message: `${ref.runner} runs "${ref.name}" with ${how}; every start may execute different code.`,
        fix: pinAdvice(ref),
      }];
    });
  },
};
