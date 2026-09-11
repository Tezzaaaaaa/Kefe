# KEFE Wizard

This directory contains the single guided-creation controller and the small pathway-specific helpers it directly coordinates.

- `wizard.js` is the single wizard controller and browser entry point.
- `wizard.css` is the wizard presentation layer.
- `lyric-pathway.js`, `lyric-pathway-hardening.js`, `lyric-pathway-style.js`, `lyric-pathway-save-bridge.js`, and `lyric-pathway-complete.js` are lyric-pathway feature helpers.
- General-purpose preview, background, caption, effect, and export logic belongs to its owning subsystem.

There must not be another wizard controller, wizard bootstrapper, or dynamic loader for these helpers.