# KEFE Effect Typography — Locked

These typography assignments are the locked design specification for the current KEFE production lyric effects. Production effects use locally bundled WOFF2 fonts from the repository; no Google Fonts or other remote font dependency is required.

| Effect | Font | Treatment |
|---|---|---|
| Apple Music | Open Sans | Premium lyric typography with smooth focus/highlight movement |
| Brat | Archivo Narrow | Compact, edge-to-edge album-cover typography |
| Eternal Sunshine | Homemade Apple | Handwritten lyric reveal with smooth organic word-level ink resolution |
| Aurora | Homemade Apple | Atmospheric handwritten typography with cinematic colour flow |
| Typewriter | Courier Prime | Restrained character-by-character reveal |
| Instagram Lyrics | **Inter Tight ExtraBold** | Bold uppercase Story composition with dominant active lyric, restrained surrounding lines and smooth stacked handoff |
| Fade Up | Momo Trust Display | Clean word-by-word rise, settle and restrained glow |

## Brat

Brat uses Archivo Narrow as its production face. The typography is lowercase, tightly tracked, deliberately soft and visually awkward in the specific way required by the Brat reference language.

## Aurora

Aurora uses Homemade Apple as its production face. The treatment uses atmospheric colour, restrained glow and cinematic movement while keeping the handwritten typography intact.

## Eternal Sunshine

Eternal Sunshine remains based on Homemade Apple. The animation is intentionally word-synchronised, but individual letters remain geometrically locked to the same baseline. This removes the previous per-letter jumping while preserving the handwritten reveal character.

## Instagram Lyrics

Instagram Lyrics uses **Inter Tight ExtraBold** as the locked production face. The composition follows the Instagram Stories lyric language: uppercase compact bold lettering, a dominant active line, quieter surrounding lines, controlled width and a smooth vertical handoff between lyric states. It uses no outline, stroke or typewriter cursor.

## Embedded font policy

The following font families are canonical for production rendering:

- Open Sans — Apple Music and UI
- Archivo Narrow — Brat
- Homemade Apple — Eternal Sunshine and Aurora
- Courier Prime — Typewriter
- Inter Tight — Instagram Lyrics
- Momo Trust Display — Fade Up

Do not substitute a different effect font without an explicit design decision.
