/**
 * Lower-case executable name without directory and common extensions.
 * @param {string | undefined} command
 * @returns {string}
 */
export function baseName(command: string | undefined): string;
/**
 * Split a shell string into words (single and double quotes only).
 * @param {string} text
 * @returns {string[]}
 */
export function splitWords(text: string): string[];
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
export function resolveLaunch(server: {
    command?: string;
    args: string[];
}): Launch;
/**
 * Package, image or script the server fetches and runs, when it is started
 * through a known runner (npx, bunx, pnpm dlx, yarn dlx, npm exec, uvx,
 * uv tool run, pipx run, docker / podman run).
 * @param {Launch} launch
 * @returns {PackageRef | undefined}
 */
export function packageOf(launch: Launch): PackageRef | undefined;
/**
 * Host-side sources of docker bind mounts (`-v src:dst`, `--mount src=...`).
 * @param {string[]} args Arguments after `run`.
 * @returns {string[]}
 */
export function dockerMounts(args: string[]): string[];
export type Launch = {
    /**
     * Effective executable (after unwrapping `cmd /c ...`).
     */
    exe: string;
    /**
     * Effective arguments.
     */
    args: string[];
    /**
     *   Set when the server is started through a shell interpreter that runs a
     *   command string (`inline`) or a script file (`script`).
     */
    shell: {
        shell: string;
        kind: "inline" | "script";
        text: string;
    } | undefined;
};
export type PackageRef = {
    ecosystem: "npm" | "pypi" | "docker";
    /**
     * Tool that fetches and runs it (npx, uvx, docker ...).
     */
    runner: string;
    /**
     * Raw package or image reference.
     */
    spec: string;
    /**
     * Name without version.
     */
    name: string;
    /**
     * Version, tag or range, if present.
     */
    version: string | undefined;
    /**
     * True only for an exact version (or an image tag / digest).
     */
    pinned: boolean;
    source: "registry" | "git" | "url" | "local";
};
