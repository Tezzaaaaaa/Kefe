# KEFE Quality Constraints

These constraints define the minimum quality bar for AI-assisted changes to KEFE.

## Product

- Preserve the six outcome-based pathways: Lyrical Videos, Captioned Videos, Music Visualisers, Music Videos, Social Videos, and Audio → Video.
- Preserve Upload Media as the initial media entry point.
- Do not turn the product back into tool-first navigation.
- Keep the user in the pathway needed to reach the expected output.

## Functional

- Do not regress media upload, playback, lyric timing, caption timing, rendering, export, authentication, billing, or responsive behavior.
- Automatic caption generation must fail safely and visibly; never silently produce a misleading result.
- Lyrics and captions are distinct workflows: lyrics may use synced lyric sources such as LRC, while captions are derived from media audio and require stronger verification.

## Engineering

- Prefer the smallest change that solves the requested problem.
- Reuse existing code before adding new dependencies or abstractions.
- No dead code, placeholder implementations, duplicated feature paths, or speculative compatibility layers.
- No weakening of tests, assertions, validation, accessibility, security, or error handling.
- No secrets, tokens, databases, generated media, or local runtime state in commits.

## Verification

For applicable changes, the expected baseline is:

- `npm run check`
- `npm run format:check`
- `npm run test:smoke`
- `npm run test:functional`
- `npm run check:ai-change`
- `npm run lint:slop`

Browser-facing changes also require desktop and mobile verification of every affected pathway.

## Change budget

Default maximum AI-assisted change:

- 20 changed files
- 1,000 changed lines

A larger change requires an explicit `KEFE_ALLOW_BROAD_CHANGE=1` override and a written reason in the task/change record.

## Release control

Implementation and deployment are separate operations. A green implementation check does not authorize production deployment.
