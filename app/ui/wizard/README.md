# KEFE Wizard

Wizard-specific helper modules live here so the editor's guided-creation code has one obvious home.

- `../wizard.js` remains the single wizard controller/entry point for compatibility with the current browser bootstrap.
- The files in this directory are supporting adapters only; they should not become parallel wizard controllers.
- General-purpose preview, background, caption, effect, and export logic belongs to their owning subsystem.

Do not add another `wizard-*` module here unless it owns a distinct responsibility that cannot live in an existing subsystem.
