# KEFE agent instructions

## Graft codebase context

KEFE is wired for Graft, a local codebase context graph for coding agents.

- Graft is provided through `npx @nanonets/graft`; it is not vendored into this repository.
- The local `graft/` directory is a regenerable cache and is intentionally gitignored.
- If `graft/` is missing or stale, run `npm run graft:build` before making architectural changes.
- Use Graft to orient before changing existing systems: `npx @nanonets/graft map`, `npx @nanonets/graft ask "<question>"`, `npx @nanonets/graft callers "<symbol>"`, and `npx @nanonets/graft check`.
- Prefer inspecting existing architecture and dependencies before creating new abstractions.
- Keep changes minimal and preserve existing behaviour unless the task explicitly requires otherwise.

## Architecture guardrails

- Inspect the existing implementation before changing it.
- Reuse existing capabilities before creating new ones; extend existing modules before duplicating them.
- Keep one authoritative implementation for each behaviour. Remove obsolete competing patches instead of layering another workaround on top.
- Keep renderer wrappers idempotent. A module that replaces `window.render` must protect against repeated installation.
- Use the repository's existing state/render architecture rather than introducing a parallel state or rendering system.
- Preserve validation, accessibility, security, reliability, and data integrity when making changes.
- Run `npm run check` after architectural changes and fix the underlying failure rather than bypassing the guardrail.

For a new checkout, the normal setup is:

```bash
npm install
npm run graft:build
```

The repository also exposes Graft through `.mcp.json` for MCP-capable coding agents. Restart the agent after changing MCP configuration.
