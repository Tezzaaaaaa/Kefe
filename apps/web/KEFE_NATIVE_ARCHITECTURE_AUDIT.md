# KEFE native architecture audit and restoration log

**Current branch snapshot:** `arena/1e82fb01-kefe`; started from published `main` at `f9fd5ced442d47ad074baef01f066c0d40ed3887` (2026-10-27).  
**Status:** active migration; not a declaration of completion. This audit separates the original KEFE application/runtime from the later React/beUI presentation layer and records the evidence used before each removal.

## Direction and preservation boundary

KEFE's native HTML, CSS, and browser JavaScript remain the architecture of record. The beUI work is a design/behavior reference only. Keep the adopted beUI appearance, interaction details, responsive states, accessibility, and current product capabilities while returning ownership of controls and panels to KEFE's native DOM/CSS/JS. Do not remove a package or build path until every remaining consumer has been identified and the replacement has been tested.

The lyric/effect/rendering modules are not UI bridges. In particular, preserve `app/effects/`, `app/lyrics/`, `app/visualiser/`, and their current editor APIs; this audit has not authorized a broad rewrite of those modules.

## Provenance and current runtime evidence

- Git history before the beUI integration contains the static editor entry and native modules (`editor.html`, `app/ui/structure.js`, `app/editor.js`, `app/settings.js`, effects, lyrics, and visualiser scripts). The native shell remains the source of the six `data-panel-view` sections and of the application behavior consumed by current UI adapters.
- On 2026-10-17, individual bridge commits introduced React controls for inputs, buttons, and tabs (for example `8066e24b`, `8536bdfd`, and `11e8f042`).
- Integration commit `94ffe68005ce673a9a3c8d1481828202a0ca36f1` (2026-10-20, parent `e5e1160d...`) added the React/TSX beUI component sources, the Vite/Tailwind pipeline, `editor.source.html`, bridge stylesheet, browser checks, and publishing workflow. This is the primary provenance point for the parallel presentation/build layer, not evidence that the editor runtime itself was rewritten in React.
- Production uses `index.html` → `apps/web/editor.html`. `editor.html` is a generated/published artifact copied from the Vite build; the build source is `editor.source.html`. The native editor still creates/manages controls and state; bridge entry modules import React roots which wrap, mirror, hide, or forward interaction to those controls.
- PR #134 (merged) removed the volume Card bridge after four viewport/theme screenshot comparisons; the KEFE-owned volume controller and range behavior remain. This restoration removes the separate six-section Card wrapper. The current editor entry now loads 13 `legacy-*-bridge.jsx` modules; 12 import `legacy-bridge.css`. These bridge counts are a migration tracker, not a success metric.
- GitHub reported the published artifact commit `f9fd5ced...` on `main`, a successful publish workflow, and a successful Pages build workflow. The Pages settings endpoint reports legacy branch-root publishing. These facts do not substitute for a direct production-browser check; no live host/browser request has been made in this task.

## Component-by-component ownership map

The detailed bridge contract and test-gap notes in [`BEUI_COMPONENT_INVENTORY.md`](./BEUI_COMPONENT_INVENTORY.md) remain the row-level source. Current ownership and status are summarized here; every live bridge still needs a consumer/lifecycle audit before removal.

| Surface | Native KEFE owner and contract | Current beUI bridge | Restoration approach / state |
|---|---|---|---|
| Editor section panels (Media, Lyric Sync, Lyric Effects, Background Effects, Visualisers, Export) | `structure.js` creates the six real panels; `editor.js`, settings adapter, desktop panel placement, effects, and visualiser modules retain those same nodes and selectors. | `legacy-panel-card-bridge.jsx` used to move all six panels' children into React Card nodes. | **Translated in this branch:** React bridge removed; original panel children remain direct DOM children, the adapter no longer searches/flattens Cards, and the native six-section `.section` shell and editor panel styles remain authoritative. Browser/static assertions now check native ownership. Browser verification still required. |
| Volume popover Card | Native volume controller in `editor.source.html`; native range API and audio volume state. | Volume Card bridge was removed by merged PR #134. | **Complete for that bridge only:** retained native popover/controller and range bridge; historical four-state screenshot evidence is recorded in session history and PR #134. |
| Range inputs | Native `<input type=range>` values, constraints, `input`/`change` events and settings notifications; `#kefeTime` is a distinct timeline. | `legacy-range-bridge.jsx` plus motion slider and slider/touch helpers. | Port appearance and range behavior to native inputs; preserve min/max/step, dynamic/settings refresh, keyboard/touch, event order, and timeline exclusion before removal. |
| Text inputs / metadata | Native input elements and editor metadata consumers; accessible labels, validation, native input/change events. | `legacy-text-input-bridge.jsx`. | Return visible ownership to the original inputs, with native styling and mutation/value/label/event checks. |
| Textareas / lyrics | Native textarea is the lyric/editor API target; caret/selection, `#lyricsInput`, spellcheck and mobile keyboard matter. | `legacy-textarea-bridge.jsx`. | Native styling and direct editing; test value, caret, selection, labels, keyboard/touch, and lyric parsing. |
| Checkboxes | Native checked/disabled inputs and label associations; e.g. review checklist IDs remain state authority. | `legacy-checkbox-bridge.jsx`. | Native styling; retain Space/keyboard, input/change order, checked/disabled/label synchronization, and dynamic insertion. |
| Upload surface | `#kefeUploadZone` label/file input/drop handlers and optional `#kefeBgVideoZone` remain KEFE-owned. | `legacy-upload-card-bridge.jsx`. | Remove wrapper after native card CSS reproduces one 192px responsive target; test file picker, drag/drop, touch, selected-file and error states. |
| Settings schema/API and overlay | `settings.beui.js` is loaded and owns the active `kefeSettings` API, defaults/storage/events; `settings/panel-component.js` and `panel-adapter.js` build the embedded editor settings surface. `settings.js` is an older, unreferenced native implementation. | `legacy-settings-bridge.jsx` provides the separate body-level Settings dialog and its controls/focus handling. | Choose one authoritative native settings surface before deleting either API/dialog. Preserve storage key/defaults/reset/listeners, focus/escape/outside behavior, and settings-panel adapter. No consolidation yet. |
| Section tabs | `structure.js` creates the actual `.kefe-section` buttons; native editor logic reads active section. | `legacy-tabs-bridge.jsx`. | Native semantic tab/navigation markup and CSS; preserve six IDs, active synchronization, keyboard and responsive behavior. |
| Visualiser tabs and power | Native visualiser options/switches and renderer modules own keys, initialization and power state. | `legacy-visualiser-tabs-bridge.jsx`. | Higher-risk: map every key, selected/power/availability state and initialization before replacing with native controls. |
| Selects | Native `<select>` values/options feed preview/export and visualiser settings; native change handlers remain consumers. | `legacy-select-bridge.jsx`. | Restore native select appearance and keyboard/mobile operation; cover dynamic options, aspect-ratio/export, native events and refresh notifications. |
| Sidebar, chrome, transport/dock | `structure.js`, `toolbar.js`, `editor.js` and native buttons own sections, fullscreen, theme, playback, restart, mute and command affordances. | `legacy-sidebar-bridge.jsx`, `legacy-chrome-bridge.jsx`. | Convert mirrored React controls to native DOM/CSS, retaining handlers, accessibility/ARIA/state updates, responsive collapse, and avoiding duplicate listeners. |
| Panel action buttons | Native buttons own section-specific actions, disabled/pressed/expanded state and keyboard/pointer semantics. | `legacy-panel-buttons-bridge.jsx`. | Apply native CSS to original buttons after dynamic scan/observer and state contract coverage; avoid competing DOM ownership. |
| Command dialog | Native command palette markup, search, shortcut/keyboard actions and dialog state are in the editor shell. | `legacy-command-dialog-bridge.jsx`. | Keep original dialog and commands; port Card/Button styling to native CSS and verify focus trap/return, escape/outside, search, keyboard navigation and dynamic list behavior. |

## Workspace and dependency responsibility map

| Workspace/tooling | Observed responsibility / evidence | Decision |
|---|---|---|
| `apps/web` React + React DOM | Current built editor entry imports 13 React bridge modules; they call `createRoot` and mount/mirror native DOM. | Still required by the current production build. Remove only after all bridges and imported React components are translated and browser verified. |
| `apps/web` Framer Motion | Motion component sources use it (Card, controls, Tabs, accordion, and slider); current bridge bundle includes these sources. | Do not remove until no live bridge/component consumes it; translate needed motion affordances to CSS/JS first. |
| `apps/web` Tailwind CSS + Vite React plugin + Vite | `beui.vite.config.ts` installs both plugins; `legacy-bridge.css` imports Tailwind layers and `panels-compact.css` / `settings/panel.css`; Vite compiles TSX/JSX and emits the editor artifact. `beui-publish.yml` builds and copies `dist-beui/editor.html` and assets into the Pages root. | Build/publish path is still necessary for the current source; replacing it requires an equivalent tested native build/copy/deploy path and CI changes, not simply removing packages. |
| `clsx`, `tailwind-merge`, `lucide-react` | Used by copied beUI utilities/components; transitive source imports are in `beui-src`. | Reassess individually after bridges/components are removed; no current removal is justified. |
| Root TypeScript | Root `tsconfig` references `packages/db`, `packages/api-client-react`, and `packages/api-zod`; API app also has TypeScript source and typecheck. | Not exclusively part of the web UI migration; keep until server/shared package responsibilities are independently changed and tested. |
| `packages/api-client-react` and React Query | Private generated React Query client is generated by `packages/api-spec/orval.config.ts`. Repository-wide search found no imports of `@workspace/api-client-react` or `@tanstack/react-query` outside the package/config/lock catalog at this snapshot. | Likely currently unused by an app, but it is a separate generated workspace product. Do not infer it is safe to delete until its intended consumer/public contract is confirmed; it is not needed by the KEFE editor's browser runtime. |
| `packages/api-zod`, API app and DB package | `apps/api` imports `@workspace/api-zod`; root typecheck references db and schema packages. | Separate backend/schema functionality; preserve and test independently. |
| pnpm workspace/lock and workflows | Workspace install; current CI runs typecheck/build/browser smoke; publish workflow pushes generated static assets to `main`. | Retain until migration and deploy route are replaced and verified. Do not use package counts as proof of completion. |

## Baseline checks and gaps (before this branch's panel change)

On the clean starting tree at `f9fd5ced...`, installed the frozen workspace lock with pnpm 10.13.1 and ran:

- `pnpm typecheck` — passed (workspace libraries plus API typecheck).
- `pnpm --filter @kefe/web build` — passed. The output included `editor.html`, a 492.69 kB CSS bundle and 464.14 kB JS bundle. Existing Vite warnings remain for classic native scripts that cannot be bundled and sourcemap positions in copied beUI sources.
- `smoke-build.mjs`, `smoke-settings-api.mjs`, `smoke-section-card-coverage.mjs` — passed on the starting tree.
- Browser test did not run locally: previous environment validation found Playwright Chromium blocked by missing `libnspr4.so` / unavailable elevated package installation. Historical GitHub Actions run `40489880368` passed browser smoke and showed 0% differences across the four desktop/mobile day/night volume-card crops; this is not browser verification of this branch's panel translation.

## Change log

### Native editor section surfaces (current branch; visual comparison pending)

- Removed `legacy-panel-card-bridge.jsx` and its `editor.source.html` load. Six section elements, their child nodes, and behavior now remain under native KEFE DOM ownership.
- Reapplied compact radius/padding to native `.kefe-panel` surfaces and converted desktop accordion/form selectors from Card-wrapper ancestry to direct panel children.
- Removed Card-wrapper CSS and the settings adapter's no-longer-needed Card flattening step.
- Replaced the static Card-presence assertion with native section/direct-child/no-React-wrapper assertions in build and browser smoke checks.
- Post-change local checks passed (`pnpm typecheck`, web production build, build/settings/native-panel smokes, built-artifact scan, syntax and diff checks). GitHub Actions PR run `40495743357` passed production build, static smokes, Chromium browser smoke, and uploaded desktop/mobile day/night captures.
- The first PR run had no prior PR screenshot artifact, so its visual-comparison step was skipped. After adding the successful `main` run (`40490755047`) as a baseline and comparing full-editor screenshots, run `40496108856` identified a day-theme regression caused by a compact-style selector also matching the outer settings-group panels. The selector is now restricted to `data-panel-view` panels. A second comparison still found the embedded panel content had lost the prior Card's 10px inset, so the native settings-slot CSS and browser smoke now explicitly preserve/assert that spacing. A successful rerun of all four editor screenshot comparisons is still required before this slice is complete or merged.

## Completion gates

1. Complete the same evidence table for every remaining production-loaded bridge, including exact script/runtime consumers, attributes/events/state, lifecycle observers, and current test coverage.
2. Translate each responsibility in a bounded slice; retain one authoritative DOM/state path and remove only its now-unused bridge/CSS/component sources.
3. Run all build/type checks, targeted behavior tests, and full editor browser regression. Compare matching desktop/mobile × day/night visuals for the affected surfaces; add focused assertions for previously uncovered keyboard/touch/accessibility behavior.
4. Once the web runtime no longer consumes them, re-run workspace-wide import/lock/config/workflow scans to decide separately whether React, React DOM, Framer Motion, Tailwind, Vite, helpers, and TS/TSX tooling remain in other workspaces.
5. Verify the final production build and deployment workflow, merge only verified work to `main`, then test the deployed editor in a real browser and record the URL, timestamp, and tested interactions. Do not report these final steps before they occur.
