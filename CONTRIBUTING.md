# Contributing

Thanks for your interest in improving **postforme-mcp-pro**!

## Workflow

1. Fork the repo and create a feature branch.
2. Make your change. Keep the typed-tool pattern (`defineTool` + Zod schema, one operation per tool).
3. Build and verify: `npm install && npm run build`.
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `feat:`, `fix:`, `docs:`).
5. Open a Pull Request describing the change and how you tested it.

## Reporting bugs / requesting features

Open an issue using the provided templates. For bugs, include the tool name, arguments,
the error message, and your environment (OS, Node version).

## Guidelines

- New API operations should be exposed as typed tools when practical; use `postforme_raw` only as a fallback.
- Mark any state-changing tool with `write: true` so it respects `POSTFORME_READONLY`.
- Never log or echo the API key. Validate external input with Zod.

## Contact

Helbert Paranhos / Strat Academy — contato@helbertparanhos.com.br
