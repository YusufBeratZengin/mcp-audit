# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog 1.1](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Audit MCP server manifests and tool definitions from local files: check excessive permissions (MCP007), hidden Unicode characters and Bidi overrides (MCP008), and suspicious prompt injection or covert instruction texts (MCP009).
- Support standalone MCP manifests (`mcp-manifest.json`) and tool definition files in project discovery and direct CLI paths.
- Initial release: discovery of known MCP config locations, six rules (MCP001-MCP006), text / JSON / SARIF output, `--fail-on` threshold and fix suggestions.
- English and Turkish documentation, reproducible terminal demo, TypeScript declarations and cross-platform quality workflows.
- In-process test discovery and coverage gates for lines, branches and functions on Node 24.

### Fixed
- Detect repeated and percent-encoded URL secret query parameters, mask their encoded and decoded values across reports, and avoid false positives for encoded references and fragment-only parameters.
- Reject report outputs that alias source configs, including hard links and symbolic links.
- Mask detected literal credentials across rule messages and fix suggestions, even when MCP001 is ignored.
- Detect cmd control operators in separate arguments, normalize filesystem paths and audit all explicit npm packages.
- Prevent malformed JSON snippets and install URLs from leaking credentials in reports.
- Classify private IP addresses without trusting similarly named public DNS hosts.
- Respect empty `NO_COLOR`, reject missing option values, support `--` and fail on invalid discovered configurations.
