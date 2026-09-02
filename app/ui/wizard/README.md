# KEFE Wizard

Wizard-specific helper modules live here so the editor's guided-creation code has one obvious home.

- `wizard.js` is the single wizard controller and browser entry point.
- The files in this directory are supporting adapters only; they should not become parallel wizard controllers.
- General-purpose preview, background, caption, effect, and export logic belongs to its owning subsystem.

## Structure

- `wizard.js` — canonical controller and guided-creation state machine.
- `wizard.css` — wizard presentation and responsive wizard layout.
- `wizard-all-effects.js` — effect/style integration adapter.
- `wizard-style-sections.js` — style-section rendering helpers.

Do not add another `wizard-*` module unless it owns a distinct responsibility that cannot live in an existing subsystem.
