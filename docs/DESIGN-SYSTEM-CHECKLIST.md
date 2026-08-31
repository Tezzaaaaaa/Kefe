# KEFE Design System QA

Reference: [Checklist Design](https://www.checklist.design/)

This checklist is the product QA baseline. It is not a source of visual code to copy.

## Typography

- [x] Semantic 1.25 type scale
- [x] Named text roles rather than pixel-only styles
- [x] Explicit line-height tokens
- [x] Explicit letter-spacing tokens
- [x] Typeface/font loading defined
- [x] Responsive type behaviour
- [x] 11px minimum UI text floor
- [x] 200% zoom-safe text sizing/layout rules
- [x] Reduced-motion handling for UI motion
- [x] High-contrast/forced-colour support
- [x] Canvas typography contracts for production effects
- [x] Preview/export font readiness gate

## Accessibility

- [x] Visible keyboard focus states
- [x] Active states are not colour-only
- [x] Error/success/loading status indicators have non-colour symbols
- [x] Coarse-pointer touch targets enlarged
- [x] Form fields remain selectable/copyable
- [x] Forced-colour fallback

## Responsive UI

- [x] Mobile type compensation
- [x] High-density display compensation
- [x] Responsive preview padding
- [x] Compact controls preserved on desktop

## Motion

- [x] UI transition reduction under `prefers-reduced-motion`
- [x] Canvas animation remains frame-driven for export fidelity
- [ ] Visual QA of every effect at 24/30/60 fps
- [ ] Visual QA at 9:16, 1:1 and 16:9

## Typography/effect integrity

- [x] Canonical Apple renderer protected
- [x] Canonical Brat renderer protected
- [x] Canonical Eternal renderer protected
- [x] Canonical Aurora renderer protected
- [x] Starfield/Pulse kept as an independent effect
- [x] Stroke and Fade Up remain modular additions
- [x] Duplicate effect implementations removed
- [x] No legacy export patch path

## Release gate

A release is not considered complete until automated validation passes and the visual QA items above have been checked against the deployed build.
