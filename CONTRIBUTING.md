# Contributing

Keep changes focused and preserve the existing interface unless a redesign is intentional.

## Before changing code

1. Confirm the issue in the live or local build.
2. Identify the responsible state, renderer or export path.
3. Avoid duplicate controls, hidden replacements and parallel implementations.

## Validation

Before publishing a change:

- Run `node --check app.js`.
- Confirm every JavaScript element reference exists in `index.html`.
- Test audio upload and metadata fields.
- Test LRC upload and lyric timing validation.
- Test preview playback, seeking and stopping.
- Test all effects and aspect ratios.
- Test export with and without an uploaded background.
- Inspect an exported file for video duration, audio duration, frame rate and frame count.
- Test the reset confirmation and `.kefe` project save/open flow.

## Style

- Keep the interface simple and functional.
- Use Open Sans for the interface.
- Reserve Homemade Apple for the Eternal effect.
- Avoid adding dependencies when the browser platform already provides the required capability.
