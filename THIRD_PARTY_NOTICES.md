# Third-party notices and font licence index

The root `LICENSE` applies to KEFE-authored code and documentation only. It does not relicense fonts, third-party software, artwork, logos, trademarks, or other bundled assets.

## Bundled third-party fonts

The applicable licence text is stored beside each bundled font file under `artifacts/kefe-visualiser/public/legacy/fonts/`.

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

## Other software

Three.js is loaded from jsDelivr in the legacy browser editor and is distributed under the MIT License: https://github.com/mrdoob/three.js/blob/dev/LICENSE

Other dependencies declared in workspace package manifests and lockfiles retain their own licences.

## System font fallback

SF Pro Display, Georgia, and Trebuchet MS are referenced as system font fallbacks; KEFE does not bundle those font files here. This notice does not grant rights to Apple's font software or trademarks.
