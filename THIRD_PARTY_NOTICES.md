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

## Runtime third-party software

The production editor bundles React, React DOM and Radix UI for its migrated components. It does not bundle an animation runtime or WebGL library. Some optional features use network services:

- **Transformers.js 2.17.2** (`@xenova/transformers`, Apache-2.0), loaded from jsDelivr only when you press **Auto-sync** in the lyric timing editor. The speech-recognition model (`Xenova/whisper-*`) is downloaded from Hugging Face on first use. Audio decoding and inference run locally in the browser; the audio is not uploaded. Model files retain the licence published on their Hugging Face model card.
- The **iTunes Search API**, **LRCLIB**, and optional **AudD** proxy are network services, not bundled software; see the privacy notice for what each request sends.

Build tooling and other workspace dependencies retain their own licences; see the package manifests and `pnpm-lock.yaml`.

## System font fallback

SF Pro Display, Georgia, and Trebuchet MS are referenced as system font fallbacks; KEFE does not bundle those font files here. This notice does not grant rights to Apple's font software or trademarks.


## shadcn/ui components

`apps/web/components/ui/` contains components adapted from the shadcn/ui New York registry
(https://github.com/shadcn-ui/ui), using Radix UI React primitives where applicable. React,
React DOM and Radix UI are bundled in the editor. Their dependency licences are
available in the installed packages.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
