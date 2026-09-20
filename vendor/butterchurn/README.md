# Butterchurn (vendored, unmodified)

Byte-for-byte copies of the npm release files. Do not edit; replace by re-copying from a new npm release.

| File | Source | sha256 |
| --- | --- | --- |
| `butterchurn.min.js` | `butterchurn@2.6.7` `lib/butterchurn.min.js` | `4e67421bc18d48fac4a6ff4e69e2778f770737fbdd4e323438da154085b4818d` |
| `butterchurnPresets.min.js` | `butterchurn-presets@2.4.7` `lib/butterchurnPresets.min.js` | `136c746836aef6dff8a1f6a93ede48c7bbe4da27d2f44de6b59ebc56ffefca10` |
| `butterchurnExtraImages.min.js` | `butterchurn@2.6.7` `lib/butterchurnExtraImages.min.js` | `379dab8dda1ccc01f752866ac005a6c5a19671437d15e98f93b321f6115f9402` |

Upstream: https://github.com/jberg/butterchurn (MIT). Licences: `LICENSE.butterchurn`, `LICENSE.butterchurn-presets`.

The KEFE bridge lives in `app/effects/visualiser-butterchurn.js`. It reaches into
`visualizer.renderer` (frame buffers, frame counter) to reset the simulation on seek, which is
tied to the 2.6.7 internals — re-check that if this version is bumped.
