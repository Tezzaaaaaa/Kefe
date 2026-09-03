# KEFE agent operating contract

This repository is maintained with a layered engineering guardrail stack: Ponytail-style agent discipline, static analysis, AI-slop detection, browser verification, code review, and optional independent AI-agent auditing.

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

## KEFE Agent Control Layer

`AGENT_CONTROL.md` is the project-specific supervisory contract for AI agents. It adapts the lifecycle discipline of addyosmani/agent-skills to KEFE rather than copying a generic skill set into the product.

For non-trivial work, follow:

**DEFINE → PLAN → CHANGE → VERIFY → REVIEW → REPORT**

The companion `CONSTRAINTS.md` is the project's quality bar. The reusable meta-skill is `.agents/skills/kefe-agent-control/SKILL.md`.

The agent is an implementer, not the product owner. User intent and repository decisions take precedence over agent preference. When evidence is incomplete, disclose uncertainty and use the HIGH / MEDIUM / LOW confidence gate defined in `AGENT_CONTROL.md`.

## Required repository behavior

1. Inspect the relevant repository files before changing code.
2. Preserve caption timing, playback, export, authentication, billing, and responsive behavior unless the request explicitly changes them.
3. Never claim a file was inspected, a test was run, or a result passed unless the evidence exists.
4. Run the applicable repository checks after changes and report failures plainly.
5. Do not expose or commit credentials, tokens, generated media, databases, or local runtime state.
6. Treat deployment as a release operation, not a normal editing operation.
7. Keep changes within the requested scope; unrelated cleanup belongs in a separate change unless it is required to make the requested change safe.
8. Do not run automatic repository-wide AI cleanup/fix commands and commit their output without reviewing the complete diff.
9. Do not add duplicate implementations, speculative compatibility layers, placeholder abstractions, or broad refactors merely because an AI tool suggests them.
10. Do not bypass a quality gate, change budget, or protected product decision merely to make an implementation easier to complete.

## Change-size protection

KEFE has a hard change blast-radius guard in `scripts/ai-change-guard.mjs`.

- Default limit: 20 changed files.
- Default limit: 1,000 changed lines.
- A deliberate broad change must explicitly use `KEFE_ALLOW_BROAD_CHANGE=1` and explain why.
- The guard is enforced locally by Husky and in pull-request CI.

## AI-slop protection

`slop-scan` is the deterministic source-level slop detector. Its configuration is committed in `slop-scan.config.json`.

- `npm run lint:slop` — inspect the repository for AI-associated code patterns.
- `npm run check:overengineer` — inspect structural over-fragmentation, duplication, fan-out, wrappers, and related patterns.
- Pull requests to `main` run a delta scan that blocks newly added or worsened slop findings.
- The pre-commit hook never auto-fixes source code.

An optional semantic gate is enabled automatically when `ANTHROPIC_API_KEY` is present. It uses `@schava09/slopgate` and blocks high-severity findings. This gate is deliberately optional locally so contributors are not forced to expose or configure an AI provider key.

## Verification baseline

Run these when the change applies:

- `npm run check`
- `npm run format:check`
- `npm run test:smoke`
- `npm run test:functional`
- `npm run check:ai-change`
- `npm run lint:slop`

Browser-facing changes must cover desktop and mobile widths and every applicable wizard path.

## Layered quality stack

Use the tools in this order rather than asking one tool to do everything:

1. **Ponytail** — agent discipline, comprehension-first behavior, and over-engineering control.
2. **KEFE Agent Control** — task definition, scope, product constraints, confidence, escalation, and auditable reporting.
3. **AI change guard** — deterministic limits on change blast radius.
4. **slop-scan** — deterministic detection of AI-associated code patterns and structural over-engineering.
5. **RoboRev** — code review/refinement and structural quality.
6. **MegaLinter** — broad repository lint/static checks.
7. **Playwright** — browser and responsive functional verification.
8. **slopgate** — optional semantic review for hallucinated APIs, silent logic drift, missing tests, and other high-severity AI-code failures.
9. **iFixAi** — independent audit of the engineering agent itself, when a real agent endpoint is available.

A green static check does not prove browser behavior, and an iFixAi fixture does not prove that an agent passed an audit.

## Independent agent audit

The KEFE iFixAi fixture is `ifixai/kefe-agent.yaml`. The optional GitHub Actions audit is `.github/workflows/ifixai-audit.yml` and is intentionally manual so normal builds do not incur external model costs.

The audit contract specifically checks repository access, change scope, verification claims, release control, escalation behavior, authorization, and auditability. Use a real deployed agent endpoint for a meaningful audit; the fixture alone is not evidence that an agent passed.
