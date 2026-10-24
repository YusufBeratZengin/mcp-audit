# Rules

Every rule lives in its own module under `src/rules/`, has tests in `test/rules.test.mjs`, and a row in the table below (a test fails when a rule has no row). Rules only read the config; they never start servers or touch the network. Secret values are always redacted in messages.

| ID | Name | Default severity | What it flags |
|---|---|---|---|
| [MCP001](#mcp001) | plaintext-secret | high (critical for known token formats) | Token, password or API key written in plain text in `env`, `headers`, `args` or `url` |
| [MCP002](#mcp002) | unpinned-package | medium | `npx -y pkg`, `uvx pkg@latest`, `pipx run`, `docker run img` without an exact version, tag or digest |
| [MCP003](#mcp003) | broad-filesystem-access | high (medium for home and credential folders) | `/`, `C:\`, `~`, `$HOME`, `/etc`, `~/.ssh` and similar given to a server |
| [MCP004](#mcp004) | shell-execution | high (medium for scripts) | Servers started through `bash -c`, `cmd /c "..."`, `powershell -Command`, and known command-execution servers |
| [MCP005](#mcp005) | insecure-transport | high (low on private networks) | `http://` or `ws://` to a non-local host |
| [MCP006](#mcp006) | unknown-provenance | low (medium for git / URL installs) | Packages installed from git or URLs, or from a publisher not on the trust list |

Severities, from least to most serious: `low`, `medium`, `high`, `critical`. `--fail-on` (default `high`) sets the lowest severity that makes the exit code 1.

## MCP001

**plaintext-secret.** Looks at three things:

- Values in `env`, `headers`, `args` and `url` that match a public credential format (GitHub, Anthropic, OpenAI-style, Slack, AWS access key id, Google API, GitLab, npm, Stripe, private key blocks, JWTs). These are `critical`.
- Literal values under keys whose name suggests a secret (`token`, `secret`, `password`, `api_key`, `auth`, `credential`, ...), including `--token=value` and `--token value` in `args`, and `user:password@` or `?api_key=` in URLs. These are `high`.
- Not flagged: references (`${VAR}`, `$VAR`, `%VAR%`, `${env:VAR}`, `${input:id}`), placeholders (`<your-token>`, `changeme`), booleans, numbers, values shorter than 6 characters, and keys ending in `_FILE`, `_PATH`, `_URL`, `_DIR` and similar.

Fix: revoke the exposed credential, then pass it by reference from the environment or a secret manager.

## MCP002

**unpinned-package.** Resolves what the server really runs, looking through `cmd /c` wrappers, and flags `npx`, `bunx`, `pnpm dlx`, `yarn dlx`, `npm exec`, `uvx`, `uv tool run`, `pipx run`, and `docker`/`podman run` when the version is missing, `latest`, a range (`^1.0.0`) or a moving tag. Exact npm versions (`1.2.3`), `==` / `@` versions for Python and image tags or digests count as pinned.

Fix: pin an exact version (or a digest for images) and update it deliberately.

## MCP003

**broad-filesystem-access.** Checks path-like arguments, `--flag=path` values, env entries whose name suggests a directory list (`ALLOWED_DIRECTORIES`, `*_PATH`, `*_ROOT`, ...) and docker bind mounts. `root` (`/`, `C:\`) and system directories are `high`; your whole home directory and credential folders (`~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.kube`, ...) are `medium`.

Fix: allow only the project folders the server needs.

## MCP004

**shell-execution.** A shell interpreter (`sh`, `bash`, `zsh`, `cmd`, `powershell`, `pwsh`) that runs a command string is `high`; one that runs a script file is `medium`. The common Windows form `cmd /c npx -y pkg` with separate arguments is not flagged. Servers whose package or name matches a list of well-known command-execution servers (for example `desktop-commander`, `mcp-server-commands`) are `high`.

Fix: start the executable directly; use command execution servers only when needed and with approval prompts on.

## MCP005

**insecure-transport.** `url` (and URLs inside `args`, as used by `mcp-remote`) that start with `http://` or `ws://`. `localhost`, `127.0.0.0/8`, `::1` and `0.0.0.0` are ignored. Private network addresses (`10.x`, `172.16-31.x`, `192.168.x`, `fc00::/7`) are `low`; everything else is `high`.

Fix: use `https://` / `wss://`.

## MCP006

**unknown-provenance.** Packages installed from a git repository or a URL instead of a registry are `medium` (`low` when pinned to a full commit hash). Registry packages whose name is not matched by the built-in list of commonly used publishers or by `--trust` are `low`. This is a prompt to look at who publishes the code, not a verdict: the built-in list is a noise filter and not a statement that those packages are safe.

Fix: review the source and maintainers, then add `--trust "<name or glob>"`.

## Adding a rule

1. Create `src/rules/<name>.mjs` exporting a `Rule` (see `src/rules/util.mjs` for the type) and register it in `src/rules/index.mjs`.
2. Add true-positive and false-positive tests to `test/rules.test.mjs`.
3. Add a row to the table above and a section below it.
4. Mention it in `CHANGELOG.md` and both READMEs.
