# KEFE architecture

KEFE is organised by responsibility. Runtime application code lives under `app/`; product assets, backend code, test infrastructure, and repository tooling remain at the root where their lifecycle is clearer.

## Application boundary

- `app/app.js` — browser application entry point and legacy editor runtime. It owns the live editor state, playback, rendering orchestration, project interactions, and compatibility surface.
- `app/core/` — application engines and runtime bridges: analysis, project persistence, rendering bridge, automation, architecture, and smart-render planning.
- `app/ui/` — browser UI behavior and presentation modules: wizard, preview, captions, backgrounds, typography, authentication, and product-polish layers.
- `app/effects/` — visual effect implementations and effect registry/catalog data.
- `app/export/` — export configuration, encoding, subtitle handling, export UI, and export enhancements.

## Supporting boundaries

- `assets/` — KEFE branding and static product artwork.
- `fonts/` — bundled typefaces used by the renderer and UI.
- `vendor/` — vendored runtime dependencies that must be served locally.
- `server/` — server-side authentication, billing, entitlement, transcription, background-removal, and database adapters.
- `tests/` — smoke and browser functional regression tests.
- `scripts/` — repository/effect verification utilities.
- `docs/` — deployment, design, architecture, licensing, and development documentation.
- `ifixai/` — independent AI-agent audit fixture.
- `.github/workflows/` — CI/CD and quality gates.

## Dependency direction

The browser entry point loads the effect layer, application runtime, core engines, UI modules, and export layer. UI modules communicate with the runtime through explicit `window.kefe*` bridges where the existing non-module editor requires a compatibility boundary. New code should prefer a narrow module boundary over adding another global or another layer of CSS overrides.

### Rules

1. Reuse an existing subsystem before creating a new one.
2. Keep ownership singular: one authoritative module should own each behavior.
3. Preserve relative module-local assets when moving files; update only cross-boundary paths.
4. Keep `app.js` as a compatibility/runtime boundary while progressively extracting cohesive domains; do not perform a risky wholesale rewrite just to reduce line count.
5. Browser behavior is the acceptance criterion: structural changes must preserve every wizard path, responsive layout, preview, playback, caption, lyric, effect, and export path.
