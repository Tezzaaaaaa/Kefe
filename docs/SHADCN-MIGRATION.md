# shadcn migration status

KEFE is **not yet a fully shadcn-based application**. The Find Your Song
carousel is excluded from this migration at the user's request. The editor is
primarily a classic-script application that creates and mutates native controls directly.
The older `shadcn-*` filenames and `data-slot` attributes are not evidence that
those controls are shadcn components. shadcn.io patterns use shadcn/ui primitives;
the migrated components here are adapted from shadcn/ui and use Radix UI.

## Migrated

- Editor and settings range sliders use the shadcn/ui Slider, with KEFE's colour
  tokens expressed in CSS instead of Tailwind. The bridge keeps the original
  inputs, events and settings API for the legacy editor. The playback timeline
  also uses Slider for seeking, with its original range retained as a backing API.
- Single-select controls in editor panels, including dynamically added lyric
  and effect controls, use shadcn/ui Select through a native-value bridge.
  Intentionally hidden backing selects and multiple selects are not replaced.
- Editor checkbox inputs (including lyric follow, embedded artwork, Slow Light
  auto-scenes and export review) use shadcn/ui Checkbox, bridged to their
  original inputs and events.
- Editor lyric, background, style and visualiser-gallery switches use shadcn/ui
  Switch, bridged to their existing state handlers. Hidden visualiser engine
  buttons remain backing controls.
- Workspace and section navigation use shadcn/ui Tabs, while the existing
  editor panel content remains in the legacy DOM. The visualiser gallery uses
  shadcn/ui Tabs, Card and Switch, delegating to its existing engine controls.
- The settings dialog uses shadcn/ui Dialog, Accordion, Button, Select, Switch
  and Slider, backed by the existing settings store. Export progress uses
  shadcn/ui Dialog, Progress and Button; the recorder remains unchanged.
- Playback transport and volume, export, header, lyric studio and lyric and
  background effect choice buttons, preview effect navigation, toolbar launcher and
  cluster buttons, lyric-style colour
  inputs and swatches, plus the lyric textarea and timing inputs, are hydrated
  as shadcn/ui Button, Textarea and
  Input without replacing the original native elements or listeners. The timing
  editor uses shadcn/ui Card; its dynamic rows are cleaned up and remounted when
  the editor rebuilds them.
- The toolbar popovers use shadcn/ui Slider for layer, text size, background
  darkness and safe-area controls, RadioGroup for segmented choices, Select for
  option menus, Checkbox for preferences, and Button/Input for their action,
  colour and nudge controls. Their popover shells remain custom.
- The standalone lyric demo uses shadcn/ui Accordion, Slider, Select, Checkbox,
  Button, Input and Textarea while retaining its renderer and native state.
- The privacy and terms pages use shadcn/ui Card and Alert; privacy also uses
  Table. Policy text and draft warnings remain available without JavaScript.
- Editor notifications use shadcn/ui Alert and Button while retaining the
  `window.kefeAlert` API, severity announcements and timed dismissal.
- Lyric display modes and alignment use shadcn/ui RadioGroup with the original
  controls as backing state, including the legacy toolbar and programmatic API.
  Autosave excludes regenerated lyric timing rows in new snapshots, while still
  accepting older version 1 snapshots.

## Remaining

- The editor shell, preview stage, timeline layout, panel containers and form
  grouping still use KEFE's existing DOM and styles rather than shadcn layout
  components. Toolbar popover shells and upload/dropzone surfaces remain custom.
- Remaining panel action buttons, non-gallery media and lyric-studio cards,
  mobile navigation surfaces and the standalone lyric demo's surrounding layout
  still need component migration.
  The old command-palette and mobile-drawer modules are not loaded by the editor.
- Desktop and mobile editor layouts, settings, lyric timing and export flows still
  rely on KEFE's existing rendering and state contracts; those behaviours must
  remain unchanged as the component ownership moves to shadcn.
- For each migration, replace the implementation with the appropriate shadcn/ui
  or shadcn.io component, preserve the existing state/events until the editor
  logic can be decoupled, and test pointer, keyboard, focus, accessibility,
  mobile layout, dynamic controls and the production build. Do not count a
  restyled or tagged native control as a completed component migration.
