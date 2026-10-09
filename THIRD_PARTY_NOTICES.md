# Third-party notices and distribution status

The root `LICENSE` applies to KEFE-authored code and documentation only. It does
not relicense third-party software, fonts, artwork, logos, trademarks, or other
assets included in or loaded by the application.

## Third-party software

- **Three.js** is loaded from jsDelivr in the legacy browser editor. Three.js is
  distributed under the MIT License. Project: https://github.com/mrdoob/three.js
  License text: https://github.com/mrdoob/three.js/blob/dev/LICENSE

Other dependencies are declared in the workspace package manifests and lockfile.
Their individual licenses remain applicable; this file is not a substitute for
an exhaustive dependency-license report.

## Fonts and type assets

The editor bundles local WOFF2 files for font families including Open Sans,
Archivo Narrow, Homemade Apple, Courier Prime, Inter Tight, Momo Trust Display,
Anton, VT323, Bricolage Grotesque, Baloo 2, Bangers, Monoton, Big Shoulders
Stencil Display, Frijole, Urbanist, Special Elite and Boogaloo. Some upstream
releases of these families are distributed under the SIL Open Font License
(OFL), but the repository does not currently include the original license text
or provenance for every bundled font file. Confirm each file against its
authoritative upstream source and include the required license/copyright
notices before public redistribution.

The following bundled font families appear custom or have not yet been matched
to a verified license in this repository: AuraSerif, BlockParty, Kefe Tracklist
Cursive, VogueNoir, BubblegumDisplay, Boulder and Memesique. Confirm that KEFE
owns the files or has permission to redistribute them before publishing a
downloadable application package containing them.

SF Pro Display is referenced as a font family name; this notice does not grant
rights to Apple's font software or trademarks.

## Release clearance

A release workflow creates a **draft prerelease** and downloadable archives for
review. Do not publish that draft until the bundled-font provenance and
third-party license notices have been checked and completed. Do not describe the
entire repository or all bundled assets as MIT-licensed.
