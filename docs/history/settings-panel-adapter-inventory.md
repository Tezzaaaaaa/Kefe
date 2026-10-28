# KEFE settings-panel adapter pass — inventory and verification

> **Current-state note (2026-10-27):** The native restoration branch removed the React panel Card wrapper. Any historical selector path below that descends through `.beui-panel-card-root > .beui-editor-panel-card` has been replaced with direct native panel/form ownership. See [`apps/web/KEFE_NATIVE_ARCHITECTURE_AUDIT.md`](../apps/web/KEFE_NATIVE_ARCHITECTURE_AUDIT.md) for current status and remaining tests.

**Historical status at original audit:** Adapter-only branch; the legacy editor remained authoritative and that earlier pass did not replace or retire UI. This file is retained for its control/key/layout evidence; consult the current architecture audit for present state and acceptance gates.

## Scope and result (historical snapshot)

- Branch at the time: `settings-panel-integration`.
- The standalone panel is mounted after the existing `.kefe-editor`; the existing editor UI remains in place.
- Adapter storage options are `storage: null`, `autoPersist: false`, `debounceMs: 80`, `exclusive: false`, and `bindShortcuts: false`.
- No direct `localStorage` calls exist in the adapter. All writes for the mapped setting use `window.kefeSettings.set()`; reset uses `window.kefeSettings.reset()`.
- No settings schema or stored-object shape changes are made.
- `kefe.style.v1` and `kefe.lyricStudio.v1` are not read or written by the adapter.
- **No legacy panel containers are moved in this pass.** CSS inspection found ancestor/direct-child selectors that would stop matching after a move; those containers remain in place rather than being restyled or changing layout modules.

## Control inventory

| New panel section / control | Existing label / control | Existing key | Shape and consumer | Disposition |
|---|---|---|---|---|
| Lyric Sync — Timing nudge (`lyric-nudge`) | Lyrics timing / Lyric offset (`#lyricsTiming`) | `lyricOffset` | Number, default `0`, range `-3..3`, step `0.05`; consumed by `app/editor.js` and `app/lyrics/lyric-studio.js` | **Mapped**. Range step aligned to existing schema; reads `defaults()` and `get()`; writes through `set()`. |
| Background — Enable Background (`background-enabled`) | No matching old setting control | — | Boolean in standalone panel only | **Disabled**; no key added. |
| Background — Mode (`background-mode`) | `#visualiserBackground` is a background selector, not the same schema | — | String enum in standalone panel | **Disabled**; not mapped to background selector; no key added. |
| Lyric Effects — Enable Lyric Effects (`lyric-effects-enabled`) | Existing `#lyricsEnabledToggle` is editor-owned and not a `kefe.settings.v1` setting | — | Boolean in standalone panel only | **Disabled**; no key added. |
| Lyric Effects — Accent colour (`lyric-accent`) | Existing effect/style colour controls are owned by the style/effect layer | — | Colour string in standalone panel only | **Disabled**; does not touch `kefe.style.v1`. |
| Visualisers — Style (`visualiser-style`) | Existing visualiser selection is managed by visualiser UI/modules | — | String enum in standalone panel only | **Disabled**; no key added. |
| Visualisers — Intensity (`visualiser-intensity`) | No matching `kefe.settings.v1` key | — | Number in standalone panel only | **Disabled**; no key added. |
| Export — Canvas ratio (`export-ratio`) | Existing aspect control uses `aspect` | `aspect` | String enum supports only `16:9`, `9:16`, `1:1` | **Disabled**. Panel includes `4:3`, so it is not mapped. |
| Export — Format (`export-format`) | Existing export flow owns format selection | — | String enum in standalone panel only | **Disabled**; no key added. |
| Export — Scale (`export-scale`) | Existing export resolution is `exportResolution`, not a scale percentage | `exportResolution` | Stored as string, default `"1080"`; used by the editor export flow | **Disabled**; not conflated with resolution. |

The standalone panel's `data-default` values are not authoritative for mapped controls. The adapter derives the Lyric Sync value from `window.kefeSettings.defaults()` and `window.kefeSettings.get('lyricOffset')`.

## Existing `kefe.settings.v1` contract

The active `apps/web/app/settings.beui.js` contract stores one JSON object:

| Key | Default / type | Known consumers | Adapter touched? |
|---|---|---|---|
| `titleCard` | Boolean `true` | `app/editor.js` title-card rendering | No |
| `lyricOffset` | Number `0`, range `-3..3`, step `0.05` | `app/editor.js`, `app/lyrics/lyric-studio.js` | **Yes**, through API only |
| `fpsTarget` | Number `60`, step `10` | Editor rendering/export timing path | No |
| `fftPower` | Number `11`, range `9..12` | `app/visualiser/audio-overlay.js` | No |
| `aspect` | String `"16:9"`; options `"16:9"`, `"9:16"`, `"1:1"` | Editor preview/export aspect path | No |
| `exportResolution` | String `"1080"`; options `"720"`, `"1080"`, `"1440"`, `"2160"` | Editor export path | No |

The older `apps/web/app/settings.js` contains a second implementation using the same `kefe.settings.v1` key, but it is not referenced by `editor.html` in the inspected script list. Neither implementation is rewritten in this pass. The adapter relies on the active `window.kefeSettings` API, not its own storage layer.

## Other settings stores explicitly left untouched

| Storage key | Value shape / owner | Consumers | Adapter touched? |
|---|---|---|---|
| `kefe.style.v1` | JSON style state (text/accent/inactive colours, scale, X/Y placement) | `app/ui/style-layer.js`, effect-default integration in `app/editor.js` | No |
| `kefe.lyricStudio.v1` | JSON object with lyric display `mode`, `chunk`, and `caseMode` | `app/lyrics/lyric-studio.js` | No |
| `kefe.apple-layout.v2` | Per-aspect object; each layout stores `lyrics` and `card` positions/scales | `app/editor.js` | No |
| `kefe.apple-layout.v1` | Legacy layout object read during migration into the v2 layout | `app/editor.js` | No |
| `kefe.effect-defaults.v1` | Per-effect defaults; may contain style, lyric-studio, and Apple-layout state | `app/editor.js` | No |
| `kefe.theme` | String: `day` or `night` | `editor.html` theme initialization/toggle | No |
| `kefe.panelWidths` | JSON object with numeric `left` and `right` widths | `app/ui/desktop-panels.js` | No |
| `kefe-settings-v1` | No source hit found in the repository searches performed | — | No |
| `kefe:editor:settings:v1` | No source hit found in the repository searches performed | — | No |

Other effect- and visualiser-specific storage is owned by their respective modules and is outside the adapter mapping; no such module or store is modified here.

## Rename checks

| Visible section name | Existing container / identifier retained | Querying modules / evidence | Result |
|---|---|---|---|
| Lyrics → Lyric Sync | `data-panel-view="lyrics"` | `structure.js`, `desktop-panels.js`, `lyric-studio.js`, `editor.js`, legacy tabs/sidebar bridges | Label is updated; old identifier remains. |
| Effects → Lyric Effects | `data-panel-view="effects"` | `structure.js`, `desktop-panels.js`, `lyric-studio.js`, effect modules and legacy bridges | Label is updated; old identifier remains. |
| Background Effects → Background | `data-panel-view="background-effects"` | `structure.js`, `desktop-panels.js`, `background.js`, legacy tabs/sidebar bridges | Old container and heading remain; no new `data-panel-view="background"` is introduced. |

The class `.kefe-background-effect-control` inside `data-panel-view="effects"` remains untouched. It identifies lyric-effect gallery/font-selector controls and is unrelated to the background slot.

## Six-slot population report

| Slot | Status | Reason |
|---|---|---|
| `media` | **Empty (layout-managed)** | `desktop-panels.js` `place()` reparents the Media container at the 1280px breakpoint. It remains in the existing editor layout. |
| `lyric-sync` | **Empty (layout-managed)** | `desktop-panels.js` `place()` reparents the Lyrics container at the 1280px breakpoint. Its identifier remains `data-panel-view="lyrics"`. |
| `background` | **Empty (deferred)** | The old container exists, but moving it breaks existing ancestor/direct-child CSS contracts. No restyling or layout-module changes are authorized. |
| `lyric-effects` | **Empty (deferred)** | Same ancestor/direct-child CSS dependency; the existing panel remains intact. |
| `visualisers` | **Empty (deferred)** | In addition to shared panel selectors, 24 inspected stylesheet selectors target `.kefe-editor .kefe-editing .kefe-panel[data-panel-view=visualiser]` and descendants. Moving would remove those selectors from scope. |
| `export` | **Empty (deferred)** | Existing panel layout/heading selectors rely on the current editor ancestry and direct-child relationship. |

The `media` and `lyric-sync` sections are expanded on initial mount so both existing `[data-kefe-fallback]` notes are visible. The panel's slot observer hides a fallback only when its corresponding slot receives a child. No slots receive children in this pass; both fallback notes remain visible.

## Slot deferral cost and resolution paths

This table is the starting scope for a separately authorized replacement pass. No DOM moves or CSS/layout changes are made by this adapter PR.

| Slot name | Blocking dependency (specific selectors / rules) | Owning module(s) | Proposed resolution path | Scope estimate |
|---|---|---|---|---|
| `media` | `desktop-panels.js` `place()` uses `document.querySelectorAll('.kefe-panel[data-panel-view]')` and reparents every panel whose `data-panel-view` is in `LEFT` into `leftWrap` at `min-width: 1280px`; below that breakpoint it inserts those panels into `rightWrap`. The existing Media panel keeps `data-panel-view="media"`. A panel placed in the new slot would be picked up and moved back into the legacy layout. | `app/ui/desktop-panels.js` (`place()`, `panels()`, `LEFT`); `app/ui/structure.js` (legacy Media panel markup / identifier). | Decide whether `place()` becomes slot-aware, the slot remains empty, or re-parenting ownership moves into the new panel. Add a responsive test for both sides of the 1280px breakpoint before moving the container. | **Layout-architecture decision first;** likely replacement-pass scope only if slot-aware placement is explicitly selected. |
| `lyric-sync` | Same `desktop-panels.js` `place()` / `panels()` global query and `LEFT` re-parenting rule; the old Lyrics panel retains `data-panel-view="lyrics"`. Its current layout position is managed with Media, not by the new slot. | `app/ui/desktop-panels.js`; `app/ui/structure.js`; existing lyric consumers in `app/lyrics/lyric-studio.js` and `app/editor.js` expect the legacy container to remain queryable. | Same architecture choice as Media; if moving, update `place()` to explicitly exclude or resolve slot-owned panels and verify all existing selectors still find the panel. Do not duplicate the Lyrics panel. | **Layout-architecture decision first;** likely replacement-pass scope only if slot-aware placement is selected. |
| `background` | Shared selectors require the old ancestry/direct-child structure: `.kefe-editor .kefe-editing .kefe-panel[data-panel-view]`, `.kefe-editor .kefe-editing .kefe-panels > .kefe-panel[data-panel-view]`, `.kefe-editor .kefe-editing .kefe-panel[data-panel-view] > .kefe-form`, plus heading/accordion selectors under `.kefe-editor .kefe-editing`. The source panel is `data-panel-view="background-effects"`, not `background`. | `app/ui/styles.css` (shared panel, direct-child, form, heading and accordion rules); `app/ui/structure.js` (container markup); `app/visualiser/background.js` (`buildUpload()`, `buildEffectCategories()`, existing `.kefe-form` insertion). | Either scope the affected shared selectors to a stable wrapper that supports both old and new placement, or keep the legacy container in its original ancestry and move only its contents through an explicit, tested slot contract. Preserve `#visualiserBackground`, `#backgroundTransparency`, and the dynamically generated upload/effect categories. | **Replacement-pass scope** if selector ownership is changed deliberately; otherwise requires a small CSS/layout refactor first. |
| `lyric-effects` | Same shared ancestry/direct-child selectors: `.kefe-editor .kefe-editing .kefe-panel[data-panel-view]`, `.kefe-editor .kefe-editing .kefe-panels > .kefe-panel[data-panel-view]`, `.kefe-editor .kefe-editing .kefe-panel[data-panel-view] > .kefe-form`, and heading/accordion rules. The old container identifier is `data-panel-view="effects"`; `.kefe-background-effect-control` within this panel is unrelated and must not be repurposed. | `app/ui/styles.css`; `app/ui/structure.js`; `app/lyrics/lyric-studio.js` and existing effect modules that query or populate the old Effects panel. | Scope the shared CSS to a placement-neutral panel wrapper, then move the existing Effects panel/contents once with consumer-query regression tests. Keep `.kefe-background-effect-control` semantics intact. | **Replacement-pass scope** with selector changes; otherwise CSS/layout refactor prerequisite. |
| `visualisers` | Shared selectors above plus visualiser-specific rules including `.kefe-editor .kefe-editing[data-selected-section="visualiser"] .kefe-panel[data-panel-view="visualiser"]`, `.kefe-editor .kefe-editing .kefe-panel[data-panel-view="visualiser"] > .kefe-vis-tabs:not([hidden])`, `.kefe-editor .kefe-editing .kefe-panel[data-panel-view="visualiser"] > .kefe-visualiser-preset-row:not([hidden])`, and descendants of `.beui-vis-tabs-host` / `.kv-grid`. The existing stylesheet has 24 visualiser-specific selector rules under this ancestry. | `app/ui/styles.css`; `app/ui/structure.js`; visualiser UI modules and `app/visualiser/background.js` for shared background/visualiser surface interactions. | Scope the visualiser selector family to a stable visualiser root rather than `.kefe-editor .kefe-editing`; audit all 24 rules and any JS queries before moving. Verify tabs, preset rows, power toggles, effect controls and dynamically generated controls after relocation. | **Replacement-pass scope plus targeted CSS refactor**; larger than a pure adapter change. |
| `export` | Shared panel ancestry/direct-child selectors and heading/accordion rules above; existing panel is `data-panel-view="export"`. Export-specific form/controls inherit those old panel and form styles and remain inside the legacy editor layout. | `app/ui/styles.css`; `app/ui/structure.js`; `app/editor.js` (export flow and existing settings consumers). | Make the shared panel/form/heading selectors placement-neutral, then move the existing Export container without duplicating its controls. Regression-test aspect/resolution, export actions, and panel collapse/expand. | **Replacement-pass scope** if selector changes are included; otherwise requires CSS/layout refactor first. |

## Background completeness and container-query check

The existing background container remains at `.kefe-panel[data-panel-view="background-effects"]` in the legacy editor. It contains `#visualiserBackground` and `#backgroundTransparency`. `app/visualiser/background.js` dynamically creates the background video upload and effect-category controls inside that panel's existing `.kefe-form` through `buildUpload()` and `buildEffectCategories()`. Because the container is not moved, its selectors and child relationships remain unchanged and the module requires no edits. A post-move claim is not applicable because no move was performed.

For the other old containers, no `data-panel-view` attribute is changed and no DOM re-parenting is performed by the adapter. Their existing modules continue to query them in their original location.

## Persistence and events

- **Mount read:** `window.kefeSettings.defaults()` supplies the expected type/default for `lyricOffset`; `window.kefeSettings.get('lyricOffset')` supplies its current value. The adapter calls `panel.applyValues(values, { silent: true })`.
- **Panel change write:** `panel.onChange(({ key, value }) => ... window.kefeSettings.set(legacyKey, value))`. Only `lyric-nudge → lyricOffset` is mapped. No raw local-storage write is used.
- **External API change:** the adapter listens to `window.kefeSettings.onChange`, updates the panel silently, and emits one panel-root `kefe:change` for the mapped key. A panel-originated write is guarded to prevent a duplicate event.
- **Reset:** `panel.onReset` calls `window.kefeSettings.reset()`, then rereads and reapplies the API values silently. The panel's existing debounced change emission reports the reset state once.
- **Initial event:** the component's queued initial `kefe:change` runs after the adapter has silently applied the old API value.
- **Storage:** the component is constructed with `storage: null` and `autoPersist: false`; its `_restore()` and `_persist()` paths therefore do not access `kefe-settings-v1`. The adapter contains no `localStorage` calls.
- No source hit was found for `kefe:editor:settings:v1` or a pre-existing `kefe:change` listener/event contract in the inspected source search. The adapter's `kefe:change` event is dispatched only from the new panel root.

## Keyboard and initialization inventory

- **Ctrl/Cmd+S:** no editor-level handler was found in the inspected `editor.html` / `app/editor.js` / `desktop-panels.js` sources. The new panel passes `bindShortcuts: false`; it does not prevent default or add a replacement shortcut. Deferred decision wording: “No editor-level Ctrl/Cmd+S handler exists in the inspected source. The panel's binding is disabled. Ctrl/Cmd+S currently does nothing in the editor. Whether to add a save shortcut — and what it should call — is deferred to a separate decision.”
- **Escape:** the panel retains Escape handling for closing its fallback tooltip; editor existing Escape listeners remain unchanged.
- Existing editor interactions found: command palette lists `⌘B` for sidebar toggle and numeric section shortcuts 1–5; editor and theme/volume/command popovers use Escape; visualiser/panel resizers use arrow keys and Home/double-click reset. These handlers are not changed.
- **Mounting point:** `editor.html` loads `app/ui/structure.js` first; it appends `KEFE_STRUCTURE` to the body. `settings.beui.js` then establishes `window.kefeSettings`. The panel adapter script is loaded after the existing editor scripts and mounts the additional panel after `.kefe-editor`.
- **Dynamic controls:** `background.js` generates background upload/effect categories; visualiser modules generate visualiser tabs/controls; `lyric-studio.js` adds lyric mode/case/timing/editor/export review controls to existing panel forms. None are recreated or moved by this adapter pass.

## Deliberately unmodified modules

`settings.beui.js`, `settings.js`, `editor.js`, `lyric-studio.js`, `audio-overlay.js`, `background.js`, `desktop-panels.js`, `structure.js`, `style-layer.js`, and the legacy range/select/panel-card/tabs/sidebar bridges are unchanged in behavior and source.

## CSS/layout stop condition that prevented container moves

The inspected production stylesheet includes shared rules such as `.kefe-editor .kefe-editing .kefe-panel[data-panel-view]`, `.kefe-editor .kefe-editing .kefe-panels>.kefe-panel[data-panel-view]`, and heading/accordion rules scoped below `.kefe-editor .kefe-editing`. Moving a panel into a slot removes the original direct-child relationship with the old `.kefe-panels` and, because the new panel is mounted beside the editor, removes both the `.kefe-editor` and `.kefe-editing` ancestors. The Visualisers panel has 24 additional selectors specifically scoped to `.kefe-editor .kefe-editing .kefe-panel[data-panel-view=visualiser]`. This pass does not change those selectors or restyle the old panels. The four non-layout-managed moves are deferred until a separate, explicitly authorized layout-compatible plan.

## Scope boundary

This pass does not remove or hide the old UI, migrate consumers, change storage keys, or retire `kefe.settings.v1`. The inventory and slot report are intended to support a separate decision about the replacement pass.
