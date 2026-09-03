---
name: kefe-agent-control
description: Supervisory workflow for AI agents making changes to KEFE. Use for every non-trivial repository task to enforce scope, evidence, product constraints, and verification.
---

# KEFE Agent Control

Use this skill as the orchestration layer for KEFE work. It is intentionally project-specific rather than a copy of a generic agent-skills repository.

## Mandatory sequence

### DEFINE
- Read `AGENTS.md` and `CONSTRAINTS.md`.
- Inspect the relevant implementation and its call sites.
- Identify the user-visible outcome and protected behavior.

### PLAN
- Select the smallest coherent implementation slice.
- Name the files expected to change.
- Decide how the result will be verified.
- Stop for clarification when ambiguity can materially change the implementation.

### BUILD
- Reuse existing code and patterns.
- Keep the diff focused.
- Make one coherent change at a time.
- Never hide failures by weakening tests, validation, or quality gates.

### TEST
- Run the narrowest relevant test/check first.
- Run the applicable KEFE baseline checks.
- For UI changes, exercise desktop and mobile behavior and every affected pathway.

### REVIEW
- Inspect the complete diff.
- Check for scope creep, duplication, over-engineering, regressions, weakened tests, and accidental architecture changes.
- Apply the AI change guard before declaring the change complete.

### REPORT
Return a compact audit record:

```text
Outcome: <what changed>
Files: <files changed>
Verification: <commands/checks actually run>
Result: <pass/fail + important failures>
Confidence: HIGH | MEDIUM | LOW
Unverified: <anything not actually proven>
Deployment: NO unless explicitly authorized and performed
```

## Escalation rules

Stop instead of guessing when:

- the requested behavior conflicts with a locked KEFE product decision;
- the relevant implementation cannot be located with enough confidence;
- a destructive or irreversible operation is required;
- a quality gate must be bypassed to proceed;
- a broad refactor appears necessary but has not been authorized;
- the evidence needed to make a safe claim is unavailable.

## Anti-rationalization rules

Do not use these arguments to bypass the workflow:

- "It's only a small change" when the affected behavior is high-risk.
- "The tests are probably enough" without running the applicable checks.
- "This cleanup is related" when it is not required for the requested outcome.
- "The AI suggested it" as justification for a new abstraction or dependency.
- "It works locally" as proof of browser, integration, or production behavior.

The goal is not to make the agent slower. The goal is to make incorrect, over-scoped, and unverified changes harder to produce.
