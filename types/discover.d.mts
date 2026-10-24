/**
 * @typedef {object} Location
 * @property {string} client Client that reads the file.
 * @property {'project' | 'user'} scope
 * @property {string} file Path shown to users, relative to the base directory or home.
 * @property {'documented' | 'believed'} confidence `documented` means the client's own
 *   documentation names this path; `believed` means it is widely used but not verified here.
 */
/**
 * Known config locations. `{cwd}` locations are checked in the project
 * directory, the others in the user's home or application-data directory.
 * @param {string} platform `process.platform` value.
 * @returns {Array<Location & { rel: string[], base: 'cwd' | 'home' | 'appdata' | 'xdg' }>}
 */
export function knownLocations(platform: string): Array<Location & {
    rel: string[];
    base: "cwd" | "home" | "appdata" | "xdg";
}>;
/**
 * @typedef {object} DiscoverOptions
 * @property {string} cwd Directory searched for project-level files.
 * @property {string} home Home directory.
 * @property {string} [platform] Defaults to `process.platform`.
 * @property {Record<string, string | undefined>} [env] Defaults to `process.env`.
 * @property {boolean} [project] Look for project files (default true).
 * @property {boolean} [user] Look for user-level files (default true).
 */
/**
 * Existing config files at the known locations.
 * @param {DiscoverOptions} options
 * @returns {Array<{ path: string, client: string, scope: 'project' | 'user', confidence: 'documented' | 'believed' }>}
 */
export function discover(options: DiscoverOptions): Array<{
    path: string;
    client: string;
    scope: "project" | "user";
    confidence: "documented" | "believed";
}>;
export type Location = {
    /**
     * Client that reads the file.
     */
    client: string;
    scope: "project" | "user";
    /**
     * Path shown to users, relative to the base directory or home.
     */
    file: string;
    /**
     * `documented` means the client's own
     * documentation names this path; `believed` means it is widely used but not verified here.
     */
    confidence: "documented" | "believed";
};
export type DiscoverOptions = {
    /**
     * Directory searched for project-level files.
     */
    cwd: string;
    /**
     * Home directory.
     */
    home: string;
    /**
     * Defaults to `process.platform`.
     */
    platform?: string | undefined;
    /**
     * Defaults to `process.env`.
     */
    env?: Record<string, string | undefined> | undefined;
    /**
     * Look for project files (default true).
     */
    project?: boolean | undefined;
    /**
     * Look for user-level files (default true).
     */
    user?: boolean | undefined;
};
