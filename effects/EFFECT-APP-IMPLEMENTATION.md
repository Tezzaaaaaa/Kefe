# Effect.app integration — KEFE

## Purpose

This document defines how the public Effect.app catalog is represented inside KEFE without copying proprietary renderer/source code.

## Data architecture

- `effect-app-public-catalog.json` is the source-of-truth catalog for the publicly listed effect/preset names.
- `effect-database.json` remains the existing KEFE carousel/application data and must not be used as a substitute for the public catalog.
- `effect-app-fx.js` contains KEFE-native Canvas implementations of selected visual treatments.
- `registry.js` contains the lyric-effect renderer registry.

## Effect record

Each production effect should eventually resolve to:

```json
{
  "id": "stable-slug",
  "name": "Display Name",
  "category": "Blur",
  "renderer": "kefe-native-renderer",
  "parameters": {},
  "animatable": true,
  "supportsImage": true,
  "supportsVideo": true
}
```

Parameter records should declare type, default, minimum, maximum, step, UI control and animation support. Do not invent exact Effect.app defaults when they are not publicly exposed.

## Preset record

```json
{
  "id": "preset-slug",
  "name": "Preset Name",
  "effects": [
    {
      "effect": "stable-slug",
      "enabled": true,
      "parameters": {}
    }
  ],
  "keyframes": {},
  "version": 1
}
```

## Rendering pipeline

Input media -> decode -> source texture/canvas -> ordered effect stack -> compositing/layer mix -> colour/output stage -> preview/export.

Preview and export should use the same renderer and parameter state so an effect does not change appearance between the editor and exported video.

## Animation

Animatable values should use per-parameter keyframe tracks. Supported public interpolation names represented in the catalog are linear, sine, ease in-out, cubic and elastic bounce.

## Current KEFE-native FX

`effect-app-fx.js` currently provides independent Canvas implementations for VHS, CRT, RGB Shift, Bloom, Motion Blur, Camera Shake, Glitch, Halftone, Vignette and Mixed Media. These are KEFE implementations inspired by the visual category, not copied Effect.app source.

## Integration rule

The catalog is comprehensive at the public-name level. Renderer implementation is a separate engineering layer. Where Effect.app exposes only a name or visual description, KEFE should implement the closest high-quality native equivalent rather than pretending to possess undisclosed Effect.app internals.
