# KEFE agent instructions

## Graft codebase context

KEFE is wired for Graft, a local codebase context graph for coding agents.

- Graft is provided through `npx @nanonets/graft`; it is not vendored into this repository.
- The local `graft/` directory is a regenerable cache and is intentionally gitignored.
- If `graft/` is missing or stale, run `npm run graft:build` before making architectural changes.
- Use Graft to orient before changing existing systems: `npx @nanonets/graft map`, `npx @nanonets/graft ask "<question>"`, `npx @nanonets/graft callers "<symbol>"`, and `npx @nanonets/graft check`.
- Prefer inspecting existing architecture and dependencies before creating new abstractions.
- Keep changes minimal and preserve existing behaviour unless the task explicitly requires otherwise.

For a new checkout, the normal setup is:

```bash
npm install
npm run graft:build
```

The repository also exposes Graft through `.mcp.json` for MCP-capable coding agents. Restart the agent after changing MCP configuration.
