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

This document records the migration contract only. The conversion is not complete until the acceptance criteria above are checked against the implemented application and tested.
