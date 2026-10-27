# Historical KEFE beUI conversion notes

> **Direction correction (2026-10-27):** This document records an earlier conversion experiment. Its goal, “required architecture,” and acceptance criteria below are superseded. KEFE's existing HTML/CSS/JavaScript, modules, dependencies, production entry and coding conventions remain authoritative. Do not migrate KEFE to React, beUI, Vite, or a parallel application architecture. Audit beUI sources for designs and behavior that can be translated into KEFE-native implementations. Preserve behavior, appearance, APIs and persisted preferences. See [`BEUI_COMPONENT_INVENTORY.md`](./BEUI_COMPONENT_INVENTORY.md) for the audited bridge-to-runtime map and validation limits. No infrastructure removal is approved by that inventory alone.

The sections below are historical context, not current requirements. In particular, “Required architecture,” “Acceptance criteria,” and branch/progress references describe the earlier experiment and must not be used to override the direction correction above.

## Historical goal

Replace the web editor's hand-authored UI with real, source-owned beUI components. Matching beUI's visual style with custom HTML/CSS was not considered completion in that experiment.

beUI's copied web components target React 19, Tailwind CSS 4, and Motion. They were copied into this repository so KEFE owns that source.

## Current-state audit

- [x] The editor is currently assembled from static HTML and imperative JavaScript.
- [x] The main workspace markup is generated from `apps/web/app/ui/structure.js`.
- [x] Settings controls are generated imperatively in `apps/web/app/settings.js`.
- [x] The editor has a large existing CSS surface in `apps/web/app/ui/styles.css` and `workspace-shell.css`.
- [x] The lyric/effect runtime is separate from the interface and must not be rewritten as part of UI conversion.
- [x] The Apple Music lyrics effect lives in `apps/web/app/effects/lyric-apple.js` and is explicitly out of scope for this migration.

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
- Migrated the visible editor section tabs to the actual beUI Tabs component while retaining the original tab buttons as hidden event-compatible adapters for existing panel logic.
- Migrated the main sidebar section navigation, Settings entry, collapse toggle, accent swatches, bottom workspace dock, preview fullscreen, playback, restart, volume, and editor-panel action buttons to actual beUI Buttons, including dynamically generated buttons in the editor panels. Hidden originals remain as event adapters so existing handlers and state updates continue to work.
- Migrated the Settings dialog layout to the actual beUI Card and implemented its controls with actual beUI Button, Switch, Select, and Range Slider components. It uses a build-specific settings API adapter; the legacy settings file and dialog remain intact until deployment cutover.
- Added a post-build asset-copy step for legacy effect/runtime files, a frozen-lockfile GitHub Actions build, asset and settings-API smoke tests, and a Chromium browser smoke test for control mounting, Settings, Select, and tab navigation.

### Not yet complete

The currently published static entry and its settings implementation are intentionally unchanged; the separate Vite-built editor output uses a build-specific settings API and mounts actual beUI components for range and select controls, tabs, sidebar navigation, transport/dock controls, editor-panel action buttons, and Settings. Remaining work includes converting editor layout surfaces and other dialogs, and validating all media/lyrics/effect/export flows. The full build and asset smoke check passed on an earlier revision; the latest additions still need a fresh CI run, and the broader browser regression suite remains outstanding.

The conversion is not complete until the acceptance criteria above are checked against the implemented application and tested.

