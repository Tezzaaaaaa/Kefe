# KEFE Review Policy

## Priority order

1. Functional correctness and user workflow continuity
2. Runtime safety and failure handling
3. Caption/lyrics timing accuracy
4. Export reliability
5. Responsive editor layout
6. Security and privacy
7. Maintainability and duplication
8. Formatting and cosmetic cleanup

## Required verification

Before accepting a fix, run:

- `npm run check`
- `npm run format:check`
- `npm run test:smoke`

Browser-facing changes must be checked at desktop and mobile widths and across every applicable wizard path.

## Fixing rules

- Do not patch the same symptom with layers of overrides. Find the authoritative source and fix it there.
- Do not delete apparently unused code until its runtime references have been checked.
- Do not change export, caption, playback, or authentication behavior without a regression test.
- Do not commit secrets, tokens, generated media, databases, or local runtime state.
- A passing formatter is not evidence that the application works.
- A passing unit/static check is not evidence that the editor works in a browser.
