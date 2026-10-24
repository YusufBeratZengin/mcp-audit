# Contributing

Use Node.js 24 for development (runtime support starts at Node 20). Work from a local checkout. Install development tools with `npm install --ignore-scripts --no-audit --no-fund`, then run:

```sh
npm run check
npm run test:coverage
npm run demo
npm pack --dry-run --ignore-scripts
```

`npm run check` runs ESLint, strict `checkJs` type checking, TypeScript declaration generation and the offline test suite. Coverage must be at least 85% for lines, branches and functions across `src/`. Node 24 CI enforces this threshold. Tests use in-process discovery of `test/**/*.test.mjs`; temporary fixtures belong under ignored `is/`. No network calls in tests. Avoid global installs and keep local npm caches under `is/` when using a restricted environment.

For rules, add positive and negative cases, register the rule in `src/rules/index.mjs`, update `docs/rules.md`, both READMEs and CHANGELOG. Keep public APIs compatible. Regenerate and include `types/` when source types change. Run every documented example, and regenerate the SVG with `npm run demo` when output changes. Never include actual credentials, personal data or machine-specific paths. Construct token-shaped fixtures from separate fragments.

Use small Conventional Commits: `fix:`, `feat:`, `test:`, `docs:`, `ci:` or `chore:`. Pull requests should explain the behavior change and relevant verification. Read [SECURITY.md](SECURITY.md) before reporting a vulnerability and follow the [code of conduct](CODE_OF_CONDUCT.md).

## Release preparation

Maintainer checklist: update CHANGELOG, bump package and lockfile versions together, regenerate declarations/demo, run all checks and review the package dry run. Commit as `chore(release): vX.Y.Z`. Version tags must match `package.json`. Do not create tags, push, create a remote repository or publish as part of routine development.

The included publish workflow runs only after an authorized version tag reaches GitHub. Before enabling it, configure the protected `npm` environment and npm trusted publishing for this repository and `publish.yml`. It uses OIDC and provenance without a stored npm token; it will fail until trusted publishing is configured. Registry publication and name availability must be verified separately by the maintainer. CI also includes Ubuntu/Windows testing, Dependabot and CodeQL; these workflows have not been executed merely by editing their files locally.
