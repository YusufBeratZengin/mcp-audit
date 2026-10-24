/**
 * Understanding how a server is started: shell wrappers, package runners and
 * the package or image that ends up being executed.
 */

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish', 'ash']);
const POWERSHELLS = new Set(['powershell', 'pwsh']);

/**
 * Lower-case executable name without directory and common extensions.
 * @param {string | undefined} command
 * @returns {string}
 */
export function baseName(command) {
  if (!command) {
    return '';
  }
  const last = command.trim().split(/[\\/]/).pop() ?? '';
  return last.replace(/\.(exe|cmd|bat|ps1|com)$/i, '').toLowerCase();
}

/**
 * Split a shell string into words (single and double quotes only).
 * @param {string} text
 * @returns {string[]}
 */
export function splitWords(text) {
  /** @type {string[]} */
  const words = [];
  for (const m of text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    words.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return words;
}

/**
 * @typedef {object} Launch
 * @property {string} exe Effective executable (after unwrapping `cmd /c ...`).
 * @property {string[]} args Effective arguments.
 * @property {{ shell: string, kind: 'inline' | 'script', text: string } | undefined} shell
 *   Set when the server is started through a shell interpreter that runs a
 *   command string (`inline`) or a script file (`script`).
 */

/**
 * Work out what a stdio server really runs.
 * @param {{ command?: string, args: string[] }} server
 * @returns {Launch}
 */
export function resolveLaunch(server) {
  const exe = baseName(server.command);
  const args = server.args;
  if (exe === 'cmd') {
    const at = args.findIndex(a => /^\/[ckrs]$/i.test(a));
    const rest = at === -1 ? [] : args.slice(at + 1).filter(a => !/^\/[ckrs]$/i.test(a));
    if (rest.length > 1) {
      return { exe: baseName(rest[0]), args: rest.slice(1), shell: undefined };
    }
    if (rest.length === 1) {
      return inline('cmd', rest[0]);
    }
    return { exe, args, shell: undefined };
  }
  if (SHELLS.has(exe)) {
    const at = args.findIndex(a => /^-[a-z]*c[a-z]*$/.test(a));
    if (at !== -1 && args[at + 1] !== undefined) {
      return inline(exe, args[at + 1]);
    }
    const script = args.find(a => !a.startsWith('-')) ?? '';
    return { exe, args, shell: { shell: exe, kind: 'script', text: script } };
  }
  if (POWERSHELLS.has(exe)) {
    const at = args.findIndex(a => /^-(c|command|encodedcommand|ec)$/i.test(a));
    if (at !== -1) {
      return inline(exe, args.slice(at + 1).join(' '));
    }
    const file = args.findIndex(a => /^-file$/i.test(a));
    return { exe, args, shell: { shell: exe, kind: 'script', text: file === -1 ? '' : (args[file + 1] ?? '') } };
  }
  return { exe, args, shell: undefined };
}

/**
 * @param {string} shell
 * @param {string} text
 * @returns {Launch}
 */
function inline(shell, text) {
  const words = splitWords(text);
  return { exe: baseName(words[0]), args: words.slice(1), shell: { shell, kind: 'inline', text } };
}

/**
 * @typedef {object} PackageRef
 * @property {'npm' | 'pypi' | 'docker'} ecosystem
 * @property {string} runner Tool that fetches and runs it (npx, uvx, docker ...).
 * @property {string} spec Raw package or image reference.
 * @property {string} name Name without version.
 * @property {string | undefined} version Version, tag or range, if present.
 * @property {boolean} pinned True only for an exact version (or an image tag / digest).
 * @property {'registry' | 'git' | 'url' | 'local'} source
 */

const NPM_VALUE_FLAGS = new Set(['-c', '--call', '--registry', '--cache', '--userconfig', '--prefix', '-w', '--workspace']);
const PY_VALUE_FLAGS = new Set(['--python', '-p', '--with', '--index', '-i', '--index-url', '--extra-index-url', '--with-requirements', '--env-file']);
const DOCKER_VALUE_FLAGS = new Set([
  '-e', '--env', '-v', '--volume', '--mount', '-p', '--publish', '--name', '-w', '--workdir', '--network', '--net',
  '--entrypoint', '-u', '--user', '--env-file', '-l', '--label', '--platform', '--add-host', '-m', '--memory',
  '--cpus', '--restart', '--pull', '--log-driver', '-h', '--hostname', '--cap-add', '--cap-drop', '--device',
  '--security-opt', '--tmpfs', '--group-add', '--ulimit', '--dns', '--shm-size', '--pid', '--ipc', '--runtime',
]);

/**
 * Classify where a package spec comes from.
 * @param {string} spec
 * @returns {'registry' | 'git' | 'url' | 'local'}
 */
function sourceOf(spec) {
  if (/^(file:|\.{1,2}[\\/]|\/|~|[A-Za-z]:[\\/])/.test(spec)) {
    return 'local';
  }
  if (/^(git\+|git:\/\/|github:|gitlab:|bitbucket:|gist:)/i.test(spec) || /^[\w.-]+\/[\w.-]+(#.*)?$/.test(spec)) {
    return 'git';
  }
  if (/^https?:\/\//i.test(spec) || /\.(tgz|tar\.gz|whl|zip)$/i.test(spec)) {
    return 'url';
  }
  return 'registry';
}

/**
 * Parse an npm package spec such as `@scope/name@1.2.3`.
 * @param {string} spec
 * @param {string} runner
 * @returns {PackageRef}
 */
function npmRef(spec, runner) {
  const source = sourceOf(spec);
  let name = spec;
  let version;
  if (source === 'registry') {
    const at = spec.lastIndexOf('@');
    if (at > 0) {
      name = spec.slice(0, at);
      version = spec.slice(at + 1);
    }
  }
  const pinned = source === 'registry' && version !== undefined && /^v?\d+\.\d+\.\d+(-[\w.-]+)?(\+[\w.-]+)?$/.test(version);
  return { ecosystem: 'npm', runner, spec, name, version, pinned, source };
}

/**
 * Parse a PyPI requirement such as `pkg==1.2.3`, `pkg@1.2.3` or `pkg>=1`.
 * @param {string} spec
 * @param {string} runner
 * @returns {PackageRef}
 */
function pypiRef(spec, runner) {
  const source = sourceOf(spec);
  let name = spec;
  let version;
  let pinned = false;
  if (source === 'registry') {
    const m = /^([A-Za-z0-9][A-Za-z0-9._-]*(?:\[[^\]]*\])?)\s*(==|===|~=|!=|>=|<=|>|<|@)?\s*(.*)$/.exec(spec);
    name = m?.[1] ?? spec;
    const op = m?.[2];
    version = m?.[3] ? m[3] : undefined;
    pinned = (op === '==' || op === '===' || op === '@') && version !== undefined && /^\d/.test(version) && !/[*,]/.test(version);
    if (op && op !== '==' && op !== '===' && op !== '@') {
      version = `${op}${version ?? ''}`;
    }
  }
  return { ecosystem: 'pypi', runner, spec, name, version, pinned, source };
}

/**
 * Parse a docker image reference.
 * @param {string} spec
 * @returns {PackageRef}
 */
function dockerRef(spec) {
  const digest = spec.includes('@sha256:');
  const lastSlash = spec.lastIndexOf('/');
  const colon = spec.indexOf(':', lastSlash + 1);
  const name = digest ? spec.slice(0, spec.indexOf('@')) : (colon === -1 ? spec : spec.slice(0, colon));
  const tag = digest ? spec.slice(spec.indexOf('@') + 1) : (colon === -1 ? undefined : spec.slice(colon + 1));
  const pinned = digest || (tag !== undefined && tag !== 'latest');
  return { ecosystem: 'docker', runner: 'docker', spec, name, version: tag, pinned, source: 'registry' };
}

/**
 * Package, image or script the server fetches and runs, when it is started
 * through a known runner (npx, bunx, pnpm dlx, yarn dlx, npm exec, uvx,
 * uv tool run, pipx run, docker / podman run).
 * @param {Launch} launch
 * @returns {PackageRef | undefined}
 */
export function packageOf(launch) {
  const { exe, args } = launch;
  if (exe === 'npx' || exe === 'bunx' || exe === 'pnpx') {
    return npmFrom(args, exe);
  }
  if ((exe === 'pnpm' || exe === 'yarn' || exe === 'bun') && args[0] === 'dlx') {
    return npmFrom(args.slice(1), `${exe} dlx`);
  }
  if (exe === 'npm' && (args[0] === 'exec' || args[0] === 'x')) {
    return npmFrom(args.slice(1), 'npm exec');
  }
  if (exe === 'uvx') {
    return pyFrom(args, 'uvx');
  }
  if (exe === 'uv' && args[0] === 'tool' && args[1] === 'run') {
    return pyFrom(args.slice(2), 'uv tool run');
  }
  if (exe === 'pipx' && args[0] === 'run') {
    return pyFrom(args.slice(1), 'pipx run');
  }
  if ((exe === 'docker' || exe === 'podman') && args[0] === 'run') {
    return dockerFrom(args.slice(1));
  }
  return undefined;
}

/**
 * @param {string[]} args
 * @param {string} runner
 * @returns {PackageRef | undefined}
 */
function npmFrom(args, runner) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') {
      return args[i + 1] ? npmRef(args[i + 1], runner) : undefined;
    }
    if (a === '-p' || a === '--package') {
      return args[i + 1] ? npmRef(args[i + 1], runner) : undefined;
    }
    if (a.startsWith('--package=')) {
      return npmRef(a.slice('--package='.length), runner);
    }
    if (a.startsWith('-')) {
      if (NPM_VALUE_FLAGS.has(a)) {
        i++;
      }
      continue;
    }
    return npmRef(a, runner);
  }
  return undefined;
}

/**
 * @param {string[]} args
 * @param {string} runner
 * @returns {PackageRef | undefined}
 */
function pyFrom(args, runner) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--from' || a === '--spec') {
      return args[i + 1] ? pypiRef(args[i + 1], runner) : undefined;
    }
    const eq = /^--(?:from|spec)=(.*)$/.exec(a);
    if (eq) {
      return pypiRef(eq[1], runner);
    }
    if (a.startsWith('-')) {
      if (PY_VALUE_FLAGS.has(a)) {
        i++;
      }
      continue;
    }
    return pypiRef(a, runner);
  }
  return undefined;
}

/**
 * @param {string[]} args
 * @returns {PackageRef | undefined}
 */
function dockerFrom(args) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('-')) {
      if (DOCKER_VALUE_FLAGS.has(a)) {
        i++;
      }
      continue;
    }
    return dockerRef(a);
  }
  return undefined;
}

/**
 * Host-side sources of docker bind mounts (`-v src:dst`, `--mount src=...`).
 * @param {string[]} args Arguments after `run`.
 * @returns {string[]}
 */
export function dockerMounts(args) {
  /** @type {string[]} */
  const mounts = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    let value;
    if (a === '-v' || a === '--volume' || a === '--mount') {
      value = args[i + 1];
      i++;
    } else if (a.startsWith('--volume=') || a.startsWith('--mount=')) {
      value = a.slice(a.indexOf('=') + 1);
    } else if (a.startsWith('-v') && a.length > 2 && !a.startsWith('--')) {
      value = a.slice(2);
    }
    if (value === undefined) {
      continue;
    }
    const mount = /(?:^|,)(?:source|src)=([^,]+)/.exec(value);
    if (mount) {
      mounts.push(mount[1]);
      continue;
    }
    const vol = /^([A-Za-z]:[\\/][^:]*|[^:]+):/.exec(value);
    if (vol) {
      mounts.push(vol[1]);
    }
  }
  return mounts;
}
