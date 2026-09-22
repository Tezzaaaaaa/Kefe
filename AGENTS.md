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

## Architecture rules (mandatory — read before touching app/)

Full diagnosis and rationale: `docs/FOUNDATION-ARCHITECTURE.md`. This repo
has a documented history of the same subsystems (nav, render pipeline,
effect wiring) getting rebuilt repeatedly because shared state and the
render function had no single owner. These rules exist to stop that
recurring. They are enforced by `node scripts/check-architecture-guardrails.mjs`,
which runs as part of `npm run check` (and therefore CI) — a violation
fails the build, it isn't just a style suggestion.

1. **Never write `window.state.x = ...` directly from a new file.** Emit
   through `window.kefe.bus` (see `app/core/architecture.js`) or extend
   the runtime bridge instead. Four files are grandfathered for this
   (`app/effects/aurora-fx.js`, `app/effects/effect-app-fx.js`,
   `app/effects/story-fade.js`, `app/export/ui.js`) — that list must not
   grow. If you're touching one of those four anyway, prefer migrating it
   off direct writes rather than adding more.
2. **Never reassign `window.render` without a re-entry guard.** Follow the
   existing pattern: check a `window.__kefe<YourFeature>Installed` flag
   (or equivalent) before wrapping, and set it once you have. Every
   existing file that wraps `window.render` does this — copy the pattern
   from `app/effects/scroll-lines.js`'s `install()` function, it's the
   clearest example. Without the guard, a script that loads twice
   double-applies its own effect.
3. **Don't add a second color-token system.** All color/surface/text
   tokens live in `app/ui/styles.css` under `:root` (`--text`,
   `--surface`, `--line`, `--red`, etc.). Keep the single night presentation
   consistent and don't reintroduce a parallel light-theme token set.
   Don't invent a new prefix (the retired `--kefe-ink`/`--kefe-paper`/
   `--kefe-red`/`--kefe-muted`/`--kefe-line`/`--kefe-radius` convention is
   what this rule exists to prevent a repeat of). Component-scoped
   structural custom properties with clear single purposes
   (`--kefe-card-index`, `--kefe-touch-target`) are fine — the rule is
   about colors/surfaces, not all custom properties.
4. **One owner per DOM region.** Before adding UI that touches the nav,
   header, or wizard shell, check whether an existing file already owns
   that region (grep the class/id first) and extend it, rather than
   having a second file independently mutate the same DOM. The commit
   history has a six-commit thrash on nav ownership from exactly this
   mistake — see `docs/FOUNDATION-ARCHITECTURE.md` section 1.7.
5. **Run `npm run check` before considering any change done.** It runs
   syntax checks, structural smoke tests, and the architecture guardrail
   script. A green run doesn't prove the UI still looks/works right — this
   sandbox has no way to launch a real browser (Playwright's browser
   download is blocked by network policy here), so **visually verify in
   an actual browser** before calling render/state/effect changes finished.
6. **No blind mass refactors of `window.state` or `window.render`
   consumers.** If asked to do the full migration described in
   `docs/FOUNDATION-ARCHITECTURE.md` section 3, do it one file at a time,
   with a visual check in between — not as one large diff. That document's
   section 3 has the order to do it in.

