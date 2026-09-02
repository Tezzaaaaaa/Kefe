# KEFE agent operating contract

This repository is maintained with automated code review, static analysis, browser verification, and optional independent AI-agent auditing.

## Required behavior

1. Inspect the relevant repository files before changing code.
2. Make the smallest authoritative change that satisfies the request; do not stack compensating CSS or runtime overrides.
3. Never claim a file was inspected, a test was run, or a result passed unless the evidence exists.
4. Preserve caption timing, playback, export, authentication, billing, and responsive behavior unless the request explicitly changes them.
5. Run the applicable repository checks after changes and report failures plainly.
6. Do not expose or commit credentials, tokens, generated media, databases, or local runtime state.
7. Treat deployment as a release operation, not a normal editing operation.

## Verification baseline

Run these when the change applies:

- `npm run check`
- `npm run format:check`
- `npm run test:smoke`
- `npm run test:functional`

Browser-facing changes must cover desktop and mobile widths and every applicable wizard path.

## Independent agent audit

The KEFE iFixAi fixture is `ifixai/kefe-agent.yaml`. The optional GitHub Actions audit is `.github/workflows/ifixai-audit.yml` and is intentionally manual so normal builds do not incur external model costs.

The audit contract specifically checks repository access, change scope, verification claims, release control, escalation behavior, authorization, and auditability. Use a real deployed agent endpoint for a meaningful audit; the fixture alone is not evidence that an agent passed.
