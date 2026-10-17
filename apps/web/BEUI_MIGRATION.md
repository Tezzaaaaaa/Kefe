# KEFE beUI conversion

## Goal

Replace the web editor's hand-authored UI with real, source-owned beUI components. Matching beUI's visual style with custom HTML/CSS is not considered completion.

beUI's current web components target React 19, Tailwind CSS 4, and Motion. Components are installed from the public beUI shadcn-compatible registry and copied into this repository so KEFE owns the code.

## Current-state audit

- [ ] The editor is currently assembled from static HTML and imperative JavaScript.
- [ ] The main workspace markup is generated from `apps/web/app/ui/structure.js`.
- [ ] Settings controls are generated imperatively in `apps/web/app/settings.js`.
- [ ] The editor has a large existing CSS surface in `apps/web/app/ui/styles.css` and `workspace-shell.css`.
- [ ] The lyric/effect runtime is separate from the interface and must not be rewritten as part of UI conversion.
- [ ] The Apple Music lyrics effect lives in `apps/web/app/effects/lyric-apple.js` and is explicitly out of scope for this migration.

## Required architecture

1. Establish React 19 + Tailwind CSS 4 + Motion as the web UI layer, using the existing workspace dependency catalog where possible.
2. Install/copy real beUI source components from the public registry; retain required MIT notices.
3. Move workspace structure, navigation, panels, buttons, inputs, selects, toggles, dialogs, tabs, menus, sliders, and editor controls to beUI components or documented beUI primitives.
4. Preserve stable DOM contracts for the legacy rendering/effect engine only where required during the transition; do not use that compatibility layer as a substitute for converting the UI.
5. Keep media/rendering/effect logic in separate modules and connect it to React through explicit adapters.
6. Remove superseded handcrafted component markup and styling after each area is migrated and verified.

## Non-negotiable preservation requirements

- Do not edit or restyle the Apple Music lyric effect as part of the UI migration.
- Preserve effect timing, LRC parsing, playback controls, preview canvas, export settings, saved settings, and media selection.
- Preserve the existing day/night appearance and responsive workspace behaviour.
- Do not delete legacy code until the equivalent React/beUI path passes regression checks.

## Acceptance criteria

- [ ] No user-facing web UI area remains implemented as bespoke component markup when a suitable beUI component exists.
- [ ] Components are actual beUI source/components, not lookalikes.
- [ ] No duplicate controls or headers are introduced.
- [ ] All controls work with mouse, keyboard, and touch; range controls retain their expected value/step behaviour.
- [ ] Existing settings persistence and effect engine integration pass regression tests.
- [ ] Apple Music lyric effect files remain unchanged by the migration.
- [ ] Production build, type checks, and browser smoke tests pass.
- [ ] A final audit maps each user-facing UI area to its beUI component and lists any unavoidable exceptions.

## Progress

### Foundation slice added on `feature/full-beui-conversion`

- Added the public `@beui` shadcn-compatible registry configuration.
- Added a Vite + React + Tailwind CSS 4 build that includes the React-enabled editor entry, workbench, and site entry points. The existing static editor.html stays unchanged until a verified Pages deployment cutover.
- Copied the upstream beUI Range Slider and its shared slider/touch/motion utilities into `apps/web/beui-src/`, retaining MIT attribution in `NOTICE.md`.
- Adapted the component's motion import to the existing workspace `framer-motion` dependency to avoid adding an unrecorded lockfile dependency.
- Added two controlled slider cases to exercise integer values and 0.05-second lyric timing steps.
- Connected the actual beUI Range Slider to production range inputs through a compatibility bridge. It preserves the existing native inputs and their event contracts for the legacy editor engine, while the dedicated playback timeline remains on its custom waveform control.
- Added the actual beUI Select and bridged existing native select controls to it, preserving change events for the preview aspect-ratio control and other legacy editor handlers.
- Migrated the Settings dialog to React using the actual beUI Button, Switch, and Range Slider components; settings still read/write through the existing persisted settings API, and the superseded imperative dialog generator has been removed from the beUI build-specific settings API; the legacy settings file remains intact until deployment cutover.
- Added a post-build asset-copy step for the legacy effect/runtime files and a frozen-lockfile GitHub Actions build check.

### Not yet complete

The currently published static entry and its settings implementation are intentionally unchanged; the separate Vite-built editor output uses a build-specific settings API and mounts actual beUI components for range and select controls and Settings. Navigation, tabs, remaining buttons, selects, editor panels, and other dialogs still require migration. The build and asset smoke check passed on an earlier revision; the current revision is awaiting its CI run, and browser-level regression testing is still outstanding.

The conversion is not complete until the acceptance criteria above are checked against the implemented application and tested.

