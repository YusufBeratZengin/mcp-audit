import assert from 'node:assert/strict';
import test from 'node:test';
import { baseName, dockerMounts, packageOf, resolveLaunch, splitWords } from '../src/launch.mjs';

/**
 * @param {string} command
 * @param {string[]} args
 */
const pkg = (command, args) => packageOf(resolveLaunch({ command, args }));

test('baseName strips directories and extensions on both separators', () => {
  assert.equal(baseName('C:\\Program Files\\nodejs\\NPX.CMD'), 'npx');
  assert.equal(baseName('/usr/bin/uvx'), 'uvx');
  assert.equal(baseName(undefined), '');
});

test('splitWords handles quotes', () => {
  assert.deepEqual(splitWords('a "b c" \'d e\' f'), ['a', 'b c', 'd e', 'f']);
});

test('cmd /c with separate arguments is unwrapped and is not a shell string', () => {
  const l = resolveLaunch({ command: 'cmd', args: ['/c', 'npx', '-y', 'pkg@1.0.0'] });
  assert.equal(l.exe, 'npx');
  assert.equal(l.shell, undefined);
  assert.deepEqual(l.args, ['-y', 'pkg@1.0.0']);
});

test('cmd /c with a single string and sh -c are inline shell commands', () => {
  const a = resolveLaunch({ command: 'cmd.exe', args: ['/c', 'npx -y pkg'] });
  assert.equal(a.shell?.kind, 'inline');
  assert.equal(a.exe, 'npx');
  const b = resolveLaunch({ command: 'bash', args: ['-lc', 'uvx tool'] });
  assert.equal(b.shell?.kind, 'inline');
  assert.equal(b.exe, 'uvx');
});

test('cmd without /c, shells with scripts and powershell variants', () => {
  assert.equal(resolveLaunch({ command: 'cmd', args: [] }).shell, undefined);
  assert.equal(resolveLaunch({ command: 'sh', args: ['run.sh'] }).shell?.kind, 'script');
  assert.equal(resolveLaunch({ command: 'pwsh', args: ['-Command', 'foo', 'bar'] }).shell?.kind, 'inline');
  assert.equal(resolveLaunch({ command: 'powershell', args: ['-File', 'a.ps1'] }).shell?.text, 'a.ps1');
  assert.equal(resolveLaunch({ command: 'powershell', args: [] }).shell?.kind, 'script');
});

test('npx variants', () => {
  assert.deepEqual(pkg('npx', ['-y', '@scope/name@1.2.3']), {
    ecosystem: 'npm', runner: 'npx', spec: '@scope/name@1.2.3', name: '@scope/name', version: '1.2.3', pinned: true, source: 'registry',
  });
  assert.equal(pkg('npx', ['-y', 'name@latest'])?.pinned, false);
  assert.equal(pkg('npx', ['name@^1.2.3'])?.pinned, false);
  assert.equal(pkg('npx', ['--registry', 'https://r', 'name'])?.name, 'name');
  assert.equal(pkg('npx', ['-p', 'real@2.0.0', 'bin'])?.name, 'real');
  assert.equal(pkg('npx', ['--package=real@2.0.0', 'bin'])?.pinned, true);
  assert.equal(pkg('npx', ['-y', '--', 'late@1.0.0'])?.name, 'late');
  assert.equal(pkg('npx', ['-y']), undefined);
  assert.equal(pkg('npx', ['-p']), undefined);
  assert.equal(pkg('npx', ['--']), undefined);
});

test('npm package sources', () => {
  assert.equal(pkg('npx', ['github:user/repo'])?.source, 'git');
  assert.equal(pkg('npx', ['user/repo#abc'])?.source, 'git');
  assert.equal(pkg('npx', ['git+https://host/x.git'])?.source, 'git');
  assert.equal(pkg('npx', ['https://host/x.tgz'])?.source, 'url');
  assert.equal(pkg('npx', ['./local'])?.source, 'local');
  assert.equal(pkg('npx', ['C:\\dev\\pkg'])?.source, 'local');
});

test('other npm runners', () => {
  assert.equal(pkg('bunx', ['x@1.0.0'])?.runner, 'bunx');
  assert.equal(pkg('pnpm', ['dlx', 'x'])?.runner, 'pnpm dlx');
  assert.equal(pkg('yarn', ['dlx', 'x'])?.name, 'x');
  assert.equal(pkg('npm', ['exec', '--', 'x'])?.runner, 'npm exec');
  assert.equal(pkg('npm', ['install'], undefined), undefined);
  assert.equal(pkg('node', ['server.js']), undefined);
});

test('python runners and requirement forms', () => {
  assert.equal(pkg('uvx', ['tool'])?.pinned, false);
  assert.equal(pkg('uvx', ['tool@latest'])?.pinned, false);
  assert.equal(pkg('uvx', ['tool@1.2'])?.pinned, true);
  assert.equal(pkg('uvx', ['tool==1.2.3'])?.pinned, true);
  assert.equal(pkg('uvx', ['tool>=1.0'])?.pinned, false);
  assert.equal(pkg('uvx', ['tool==1.*'])?.pinned, false);
  assert.equal(pkg('uvx', ['--python', '3.12', 'tool'])?.name, 'tool');
  assert.equal(pkg('uvx', ['--from', 'real==1.0.0', 'cmd'])?.name, 'real');
  assert.equal(pkg('uvx', ['--from=real==1.0.0', 'cmd'])?.pinned, true);
  assert.equal(pkg('uvx', ['--from']), undefined);
  assert.equal(pkg('uvx', ['--quiet']), undefined);
  assert.equal(pkg('uv', ['tool', 'run', 'tool==1.0'])?.runner, 'uv tool run');
  assert.equal(pkg('pipx', ['run', '--spec', 'a==1', 'a'])?.pinned, true);
  assert.equal(pkg('uvx', ['git+https://host/r.git'])?.source, 'git');
  assert.equal(pkg('uvx', ['https://host/p.whl'])?.source, 'url');
  assert.equal(pkg('uvx', ['tool[extra]==1.0'])?.name, 'tool[extra]');
});

test('docker images', () => {
  assert.equal(pkg('docker', ['run', '-i', '--rm', '-e', 'K', 'img'])?.pinned, false);
  assert.equal(pkg('docker', ['run', 'img:latest'])?.pinned, false);
  assert.equal(pkg('docker', ['run', 'reg.io:5000/org/img:1.2.3'])?.pinned, true);
  assert.equal(pkg('docker', ['run', 'reg.io:5000/org/img'])?.version, undefined);
  const digest = pkg('podman', ['run', 'org/img@sha256:abc']);
  assert.equal(digest?.pinned, true);
  assert.equal(digest?.name, 'org/img');
  assert.equal(pkg('docker', ['run', '--rm']), undefined);
  assert.equal(pkg('docker', ['ps']), undefined);
});

test('dockerMounts extracts host paths', () => {
  const mounts = dockerMounts(['-v', '/:/host', '--volume=C:\\data:/d:ro', '-v/srv:/s', '--mount', 'type=bind,source=/etc,target=/e', '--mount=type=bind,src=/x,dst=/y', '--rm', '-v', 'named']);
  assert.deepEqual(mounts, ['/', 'C:\\data', '/srv', '/etc', '/x']);
});
