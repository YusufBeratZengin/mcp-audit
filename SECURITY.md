# Security policy

Version 0.1.x is the supported line.

mcp-audit reads configuration files and prints findings. It never starts the servers it inspects, never makes network calls and redacts secret values in every output format. If you find a way to make it leak a value, execute a command from a config, or crash on a crafted file, please report it.

Use **Report a vulnerability** under the repository's [Security tab](https://github.com/YusufBeratZengin/mcp-audit/security) (GitHub private vulnerability reporting). The maintainer must enable it in the repository settings before the first public release. If the button is missing, open an issue asking for a private channel, without exploit details. Do not paste real credentials anywhere; construct fake ones from fragments. No response-time guarantee is offered.

Missing detections are not security vulnerabilities of this tool; open a normal feature request instead. The tool is a linter and does not replace reviewing what an MCP server can do.
