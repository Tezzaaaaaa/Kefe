# KEFE repository map

KEFE uses a small number of responsibility-first areas. If a change belongs to one of these areas, keep it there rather than adding another top-level file.

| Area | Purpose |
| --- | --- |
| `app/` | Browser application code |
| `app/core/` | State, analysis, rendering and project engines |
| `app/effects/` | Lyric and visual effects |
| `app/export/` | Export pipeline and export UI |
| `app/ui/` | Editor UI and interaction systems |
| `assets/` | Product branding and static artwork |
| `fonts/` | Bundled application fonts |
| `vendor/` | Third-party runtime assets that must ship with KEFE |
| `server/` | Server-side integrations and services |
| `tests/` | Browser and functional verification |
| `scripts/` | Developer verification utilities |
| `docs/` | Architecture, deployment and contributor documentation |
| `ifixai/` | Independent AI-agent audit fixture and configuration |
| `.github/` | CI/CD, security and repository automation |

## Root policy

The repository root is intentionally boring. Keep only files that are genuinely project-wide entry points, package metadata, contributor/agent policy, or GitHub-recognised repository configuration there.

Do not add feature code, UI modules, effect implementations, test helpers or one-off generated files to the root.

## Icon language

Repository documentation uses a restrained file/folder icon language: familiar symbols, one semantic icon per area, and no decorative icon dependency in application runtime code. This keeps the repository easy to scan without adding maintenance overhead.

The visual convention follows the same principle used by established icon systems such as GitHub Octicons: recognizable, consistent symbols are preferable to a different novelty icon for every file type. citeturn0search4turn0search6
