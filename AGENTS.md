# KEFE agent operating contract

This repository is maintained with a layered engineering guardrail stack: Ponytail-style agent discipline, static analysis, browser verification, code review, and optional independent AI-agent auditing.

## Agent discipline

When Ponytail is installed in the host agent, use its `full` mode as the normal KEFE engineering level. Use `ultra` only for a deliberate whole-repository audit or difficult regression investigation; use `off` only when explicitly required by the host workflow.

Apply the same discipline even when the Ponytail plugin is not installed:

1. Comprehension first: inspect the relevant files, call sites, data flow, and existing patterns before writing code.
2. YAGNI: do not build a feature, abstraction, wrapper, dependency, or configuration that the request does not require.
3. Reuse first: prefer existing helpers, utilities, components, browser APIs, and installed dependencies over new implementations.
4. Make the smallest authoritative change that solves the problem; do not stack compensating CSS or runtime overrides.
5. After editing, verify behavior rather than assuming it. If a test cannot be run, say so explicitly.
6. Before a broad refactor, use a review/audit pass to identify dead code, duplication, unnecessary abstractions, and scope creep.

Useful Ponytail reviews when the host supports them:

- `/ponytail-review` — review a proposed change for unnecessary complexity.
- `/ponytail-audit` — audit the repository for accumulated over-engineering.
- `/ponytail-debt` — record actionable technical debt rather than expanding scope opportunistically.
- `/ponytail-gain` — review measured engineering impact when benchmark data exists.

## Required repository behavior

1. Inspect the relevant repository files before changing code.
2. Preserve caption timing, playback, export, authentication, billing, and responsive behavior unless the request explicitly changes them.
3. Never claim a file was inspected, a test was run, or a result passed unless the evidence exists.
4. Run the applicable repository checks after changes and report failures plainly.
5. Do not expose or commit credentials, tokens, generated media, databases, or local runtime state.
6. Treat deployment as a release operation, not a normal editing operation.
7. Keep changes within the requested scope; unrelated cleanup belongs in a separate change unless it is required to make the requested change safe.

## Verification baseline

Run these when the change applies:

- `npm run check`
- `npm run format:check`
- `npm run test:smoke`
- `npm run test:functional`

Browser-facing changes must cover desktop and mobile widths and every applicable wizard path.

## Layered quality stack

Use the tools in this order rather than asking one tool to do everything:

1. **Ponytail** — agent discipline, comprehension-first behavior, and over-engineering control.
2. **RoboRev** — code review/refinement and structural quality.
3. **MegaLinter** — broad repository lint/static checks.
4. **Playwright** — browser and responsive functional verification.
5. **iFixAi** — independent audit of the engineering agent itself, when a real agent endpoint is available.

A green static check does not prove browser behavior, and an iFixAi fixture does not prove that an agent passed an audit.

## Independent agent audit

The KEFE iFixAi fixture is `ifixai/kefe-agent.yaml`. The optional GitHub Actions audit is `.github/workflows/ifixai-audit.yml` and is intentionally manual so normal builds do not incur external model costs.

The audit contract specifically checks repository access, change scope, verification claims, release control, escalation behavior, authorization, and auditability. Use a real deployed agent endpoint for a meaningful audit; the fixture alone is not evidence that an agent passed.
