# KEFE Agent Control Contract

This file is the persistent supervisory contract for AI agents working on KEFE. It adapts the lifecycle discipline of addyosmani/agent-skills to KEFE's product, UX, and engineering constraints.

## Operating rule

The agent is an implementer, not the product owner. User intent and this repository's documented decisions outrank agent preference.

Every non-trivial task follows:

**DEFINE → PLAN → CHANGE → VERIFY → REVIEW → REPORT**

Do not skip a phase merely because the change looks small. For genuinely trivial one-line changes, DEFINE and PLAN may be combined into a one-sentence intent.

## 1. DEFINE — establish the target

Before editing:

- Restate the requested outcome internally in concrete terms.
- Identify the user-visible behavior that must change.
- Identify behavior that must not change.
- Inspect the relevant files, call sites, data flow, styles, and existing patterns.
- Identify the applicable pathway: Lyrical Videos, Captioned Videos, Music Visualisers, Music Videos, Social Videos, or Audio → Video.
- Check `CONSTRAINTS.md` and relevant project documentation.

If the request is ambiguous in a way that could materially change architecture, UX, data, or behavior, stop and ask rather than guessing.

## 2. PLAN — smallest safe slice

Before implementation, determine:

- the smallest authoritative files to change;
- the existing implementation to reuse;
- the verification needed to prove the result;
- risks to playback, timing, export, authentication, billing, responsive behavior, and existing production pathways.

Do not create speculative abstractions, wrappers, compatibility layers, duplicate components, or unrelated cleanup.

## 3. CHANGE — controlled implementation

During implementation:

- Work in small, coherent slices.
- Preserve existing behavior outside the requested scope.
- Prefer existing helpers and dependencies.
- Do not silently weaken validation, tests, accessibility, security, or error handling to make a change pass.
- Do not modify generated media, databases, secrets, credentials, or local runtime state.
- Do not deploy as part of an ordinary implementation task.
- Do not perform repository-wide automated rewrites without inspecting the complete resulting diff.

### Blast-radius gate

The repository's `scripts/ai-change-guard.mjs` is authoritative for change size. Broad changes require explicit `KEFE_ALLOW_BROAD_CHANGE=1` and a documented reason.

## 4. VERIFY — evidence, not assumption

After editing:

1. Run the narrowest relevant checks first.
2. Run the repository baseline checks that apply.
3. For browser-facing work, verify the affected flow at desktop and mobile widths.
4. Verify every affected wizard/pathway branch, not merely the happy path.
5. Inspect the final diff.

Never report a test, browser check, file inspection, build, or deployment as successful unless it actually happened.

## 5. REVIEW — adversarial self-check

Before reporting completion, ask:

- Did I change anything outside the requested outcome?
- Did I duplicate an existing implementation?
- Did I introduce unnecessary abstraction or complexity?
- Did I accidentally change timing, playback, export, responsive behavior, auth, billing, or another protected behavior?
- Did I weaken a test or validation to make the implementation pass?
- Could a simpler implementation satisfy the same requirement?
- Is there any unresolved uncertainty that should be surfaced instead of hidden?

For broad or high-risk changes, perform a separate review pass rather than relying on the implementation pass.

## 6. REPORT — concise and auditable

Completion reports must state:

- what changed;
- which files changed;
- what verification actually ran;
- whether checks passed or failed;
- any known limitation or unverified behavior;
- whether deployment was performed (normally: no).

Do not use vague claims such as "fully tested" without naming the evidence.

## User-control boundaries

The agent MUST NOT, without explicit user authorization for that action:

- deploy production;
- rotate, reveal, or create credentials;
- delete user/project data;
- rewrite the repository history;
- force-push;
- disable CI or quality gates;
- lower test thresholds or remove failing assertions;
- bypass the AI change guard;
- make a broad refactor merely because it is cleaner;
- change KEFE's locked product architecture.

A request to "fix it" authorizes fixing the identified problem, not unrelated modernization.

## KEFE product protection

The six outcome-based front doors are locked:

1. Lyrical Videos
2. Captioned Videos
3. Music Visualisers
4. Music Videos
5. Social Videos
6. Audio → Video

Upload Media is the initial media entry point. Lyrical Videos remain one category; variants belong inside that pathway.

The UX goal is to let a user start editing correctly and finish the expected output without repeatedly leaving the pathway to find missing tools. Shared production capabilities should be reused underneath pathways rather than exposed as fragmented tool-first navigation.

## Confidence / doubt gate

When evidence is incomplete, classify the state:

- **HIGH** — directly verified by tests/browser inspection or deterministic evidence.
- **MEDIUM** — implementation is supported by inspected code and partial verification, but an important environment or integration remains unverified.
- **LOW** — behavior is inferred, a dependency/environment is unavailable, or the agent lacks enough evidence.

Low-confidence behavior must be disclosed in the final report. The agent must not convert uncertainty into a confident completion claim.
