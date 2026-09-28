# KEFE Effect Typography — Locked

Each production lyric effect has one canonical typography pairing. The effect renderer must resolve its production font from `window.KEFE_TYPE.effects`; effect-specific font selectors must not override a locked pairing.

| # | Effect | Font |
|---:|---|---|
| 1 | Apple | Open Sans |
| 2 | Brat | Archivo Narrow |
| 3 | Eternal Sunshine | Homemade Apple |
| 4 | Aurora | Bricolage Grotesque |
| 5 | Typewriter | Courier Prime |
| 6 | Instagram | Inter Tight |
| 7 | Drop | Frijole |
| 8 | Barbie | Baloo 2 |
| 9 | Elastic Pop | Bangers |
| 10 | Flip Text | Urbanist |
| 11 | Karaoke | Boogaloo |
| 12 | Fancy | Anton |
| 13 | Glitch | Special Elite |
| 14 | Analog TV | VT323 |
| 15 | Split-Flap | Big Shoulders Stencil Display |
| 16 | Chromatica | Memesique |
| 17 | Pulse | AuraSerif |
| 18 | Fade Up | BlockParty |
| 19 | Decrypt | Kefe Tracklist Cursive |
| 20 | Blur In | VogueNoir |
| 21 | Shiny | BubblegumDisplay |
| 22 | Rise | Boulder |
| 23 | Slide | Pending — no unique bundled font currently available |
| 24 | Drift | Pending — no unique bundled font currently available |
| 25 | Scroll Lines | Pending — no unique bundled font currently available |
| 26 | Trailer | Monoton |

## Wiring rule

The 23 currently assigned pairings are locked production assignments. Apple uses the platform SF Pro Display/system stack and does not require a bundled Apple font. Anton and VT323 are now bundled locally for Fancy and Analog TV. Slide, Drift and Scroll Lines remain explicitly unassigned until unique bundled fonts are available; they must not silently inherit another effect's production font.

Trailer is already canonically assigned to Monoton in the typography registry.

The repository currently contains fewer unique font families than the 26-effect target requires. Apple uses the platform SF Pro system stack rather than redistributing Apple's font files. Do not reuse an existing production font to fill the remaining slots.

All production fonts are locally bundled WOFF2 files. No remote font dependency is introduced.
