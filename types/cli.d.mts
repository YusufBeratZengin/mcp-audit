/**
 * Parse command-line arguments.
 * @param {string[]} argv
 * @returns {{ error?: string, help?: boolean, version?: boolean, listRules?: boolean, paths: string[],
 *   format: string, failOn: string, ignore: string[], trust: string[], user: boolean, output?: string, color?: boolean }}
 */
export function parseArgs(argv: string[]): {
    error?: string;
    help?: boolean;
    version?: boolean;
    listRules?: boolean;
    paths: string[];
    format: string;
    failOn: string;
    ignore: string[];
    trust: string[];
    user: boolean;
    output?: string;
    color?: boolean;
};
/**
 * Run the CLI.
 * @param {string[]} argv Arguments without node and script path.
 * @param {Partial<Io>} [overrides] Injected streams and environment (tests).
 * @returns {number} Exit code.
 */
export function main(argv: string[], overrides?: Partial<Io>): number;
export const HELP: string;
export type Io = {
    cwd: string;
    home: string;
    stdout: {
        write: (text: string) => unknown;
        isTTY?: boolean;
    };
    stderr: {
        write: (text: string) => unknown;
    };
    env: Record<string, string | undefined>;
    platform: string;
};
