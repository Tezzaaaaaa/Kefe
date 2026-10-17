# Third-party notices and font licence index

The root `LICENSE` applies to KEFE-authored code and documentation only. It does not relicense fonts, third-party software, artwork, logos, trademarks, or other bundled assets.

## Bundled third-party fonts

The applicable licence text is stored beside each bundled font file under `apps/web/fonts/`.

| Font family | Bundled font directory | Licence file | Licence |
|---|---|---|---|
| Open Sans | `open-sans/` | `OFL.txt` | SIL Open Font License 1.1 |
| Archivo Narrow | `archivo-narrow/` | `OFL.txt` | SIL Open Font License 1.1 |
| Homemade Apple | `homemade-apple/` | `LICENSE.txt` | Apache License 2.0 |
| Courier Prime | `courier-prime/` | `OFL.txt` | SIL Open Font License 1.1 |
| Inter Tight | `inter-tight/` | `OFL.txt` | SIL Open Font License 1.1 |
| Momo Trust Display | `momo-trust-display/` | `OFL.txt` | SIL Open Font License 1.1 |
| Anton | `anton/` | `OFL.txt` | SIL Open Font License 1.1 |
| VT323 | `vt323/` | `OFL.txt` | SIL Open Font License 1.1 |
| Bricolage Grotesque | `bricolage-grotesque/` | `OFL.txt` | SIL Open Font License 1.1 |
| Baloo 2 | `baloo2/` | `OFL.txt` | SIL Open Font License 1.1 |
| Bangers | `bangers/` | `OFL.txt` | SIL Open Font License 1.1 |
| Urbanist | `urbanist/` | `OFL.txt` | SIL Open Font License 1.1 |
| Boogaloo | `boogaloo/` | `OFL.txt` | SIL Open Font License 1.1 |
| Monoton | `monoton/` | `OFL.txt` | SIL Open Font License 1.1 |
| Big Shoulders Stencil Display | `big-shoulders-stencil/` | `OFL.txt` | SIL Open Font License 1.1 |
| Frijole | `frijole/` | `OFL.txt` | SIL Open Font License 1.1 |
| Special Elite | `special-elite/` | `LICENSE.txt` | Apache License 2.0 |

The OFL and Apache licence files were copied from the corresponding family directories in the official Google Fonts repository. Each licence file retains its upstream copyright and licence text.

Official source index: https://github.com/google/fonts

## KEFE original merged fonts

The following are identified in the KEFE typography registry with an asterisk (`*`) as KEFE original merged-font creations:

- AuraSerif *
- BlockParty *
- Kefe Tracklist Cursive *
- VogueNoir *
- BubblegumDisplay *
- Boulder *

See [the KEFE custom-font notice](fonts/CUSTOM-FONTS-LICENSE.md) for the scope of the attribution and permissions. These fonts were made by merging or modifying other font designs. The applicable source-font licences still govern the merged font files; this notice does not override upstream terms. Keep the source-font identities and required notices with the project.

## Other software and externally loaded code

The browser editor currently loads `gif.js@0.2.0` from jsDelivr. The editor source also dynamically imports `@uimaxbai/am-lyrics@1.8.2` from jsDelivr for the Apple-style lyric component.

### `gif.js@0.2.0`

- Upstream: https://github.com/jnordberg/gif.js
- Licence: MIT, confirmed against the upstream `LICENSE` file and `package.json`.
- Copyright notice in the upstream licence: Copyright (c) 2013–2018 Johan Nordberg.
- Include the upstream MIT copyright and permission notice with copies or substantial portions of the software.

### `@uimaxbai/am-lyrics@1.8.2`

- Upstream: https://github.com/binimum/am-lyrics
- Licence: MPL-2.0, confirmed against the exact upstream `package.json` version 1.8.2 and repository `LICENSE`.
- The component documentation says it can request lyrics from third-party providers when title, artist, query, music ID or related metadata is supplied. KEFE's current integration clears those lookup properties and supplies its existing TTML lyrics only; this is a source-level observation, not a substitute for testing actual network traffic.
- Preserve the MPL-2.0 notices and comply with its conditions if distributing or modifying covered source. The component's bundled/runtime dependency licence obligations still need a release-specific review.

### Remaining checks

- Verify actual network behaviour and data transfers for the Apple-style lyric component before finalising the privacy policy or claiming lyric rights clearance.
- Review transitive/bundled dependency notices and consider bundling dependencies and pinning integrity hashes (Subresource Integrity where supported) after checking compatibility.
- Do not list Three.js as a current runtime dependency unless a fresh audit confirms it is loaded by the release build.

## System font fallback

SF Pro Display, Georgia, and Trebuchet MS are referenced as system font fallbacks; KEFE does not bundle those font files here. This notice does not grant rights to Apple's font software or trademarks.
