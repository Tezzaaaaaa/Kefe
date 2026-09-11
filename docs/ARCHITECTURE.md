# KEFE architecture

KEFE is organised around the existing application runtime and a single guided workflow. The goal is to keep the codebase small, understandable, and resistant to duplicate implementations.

## Application boundary

- `app/app.js` — the existing browser application runtime. It owns the live editor state and the underlying audio, media, playback, rendering, and compatibility behavior already implemented there.
- `app/core/` — only standalone engines that have a real, independently testable responsibility. Do not create a generic architecture layer or abstraction here.
- `app/ui/` — UI features and presentation modules.
- `app/ui/wizard/wizard.js` — the single guided-creation controller. It owns pathway selection, step navigation, validation, and wizard presentation.
- `app/ui/wizard/lyric-pathway*.js` — lyric-pathway-specific feature helpers. They support the wizard; they do not create another workflow.
- `app/effects/` — effect implementations and their shared effect runtime.
- `app/export/` — export implementation and export UI.

## Supporting boundaries

- `assets/` — branding and static product artwork.
- `fonts/` — bundled typefaces.
- `vendor/` — vendored runtime dependencies.
- `server/` — server-side services.
- `tests/` — regression and functional tests.
- `scripts/` — repository verification utilities.
- `.github/workflows/` — CI/CD and quality gates.

## Rules

1. Find the existing owner before writing code.
2. Extend the owner when the responsibility already exists.
3. Do not create a second implementation to avoid modifying the first.
4. Do not add a generic abstraction layer unless a concrete, repeated need exists.
5. Do not dynamically load a subsystem that is already loaded by the application entry point.
6. A replacement is not complete until the superseded implementation is removed.
7. Keep the browser entry point explicit: dependencies should be visible in `index.html` unless lazy loading is genuinely required.
8. Structural changes must preserve the working editor, wizard, preview, playback, lyrics, effects, and export behavior.
