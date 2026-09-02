# KEFE Visual Effects

Production lyric effects are maintained as independent modules under this directory. Each renderer receives the common arguments `(ctx, width, height, style, lines, time)` and registers through `window.kefeEffects`.

## Production lyric effects

- `brat.js` — Brat typography
- `eternal-sunshine.js` — Eternal Sunshine handwritten treatment
- `aurora.js` — Aurora marker/colour treatment
- `typewriter.js` — character-by-character reveal
- `instagram-lyrics.js` — Instagram Stories Music lyric treatment
- `story-fade.js` — Fade Up lyric treatment

`core.js` contains shared timing, typography and drawing helpers. `registry.js` is the single dispatch point for modular lyric renderers.

## Instagram Lyrics

`instagram-lyrics.js` is the production replacement for the removed Stroke effect. It follows the shared KEFE typography contract and uses synced line timing from the application rather than maintaining a separate lyric-timing implementation.

The renderer is deliberately restrained: bold uppercase text, a dominant active line, quieter neighbouring lines, compact spacing, automatic width fitting and smooth handoff between lyric states. It does not use a stroke, outline, glow, typewriter cursor or destructive canvas compositing.

The effect-specific controls and defaults are registered through `registry.js`, while reusable preset names are maintained in `presets.json`.

The effect registry is intentionally separate from the DeepSeek development archive.
