# KEFE branding assets

This directory contains the canonical KEFE Visualiser brand marks used by the application.

## Canonical brand identifiers

| Identifier | Asset | Use |
|---|---|---|
| `kefe-logo` | `kefe-logo.svg` | Primary KEFE wordmark |
| `kefe-logo-light` | `kefe-logo-light.svg` | Light/white wordmark for dark UI surfaces |
| `kefe-logo-full` | `kefe-logo-full.svg` | Full KEFE Visualiser lockup |
| `favicon` | `/favicon.svg` | Browser/site icon |

The application header currently uses `kefe-logo-light.svg`.

## Brand colour

The KEFE accent red is `#EF3F38`.

Use the shared CSS token `--red` for interface elements rather than introducing a second red value. The corresponding pressed state is `--red-press`.

The red play/arrow mark inside the KEFE logo is part of the brand mark and uses `#EF3F38` in all SVG logo variants.

## Icon and UI identifiers

- `play-button` — primary playback control; KEFE red.
- `icon-button` — standard secondary icon control.
- `brand-logo` — application brand image.
- `brand-logo-night` — dark-surface header logo variant.
- `preview` — main visual preview container.
- `transport` — playback transport controls.

Keep these identifiers stable when making visual refinements so existing CSS and JavaScript hooks continue to work.

## Source of truth

SVG brand marks in this directory are the editable/vector source assets. Keep their proportions and path geometry unchanged when changing colour variants.

Repository navigation icon semantics are documented separately in `assets/repository-icons/README.md`.
