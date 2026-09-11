# Security Policy

## Supported Versions

KEFE is currently under active development. Security fixes are applied to the current `main` branch.

| Version | Supported |
| --- | --- |
| `main` | :white_check_mark: |
| Older commits and unreleased versions | :x: |

Because KEFE has not established a formal release-version policy yet, users should run the latest version available from the `main` branch and update promptly when security fixes are published.

## Reporting a Vulnerability

Please report suspected security vulnerabilities privately through GitHub's **Report a vulnerability** feature on the repository's Security tab.

Do not disclose vulnerabilities in public issues, pull requests, discussions, or other public channels before a fix or mitigation is available.

When reporting a vulnerability, include:

- A clear description of the issue and its potential impact.
- The affected file, feature, endpoint, or workflow, if known.
- Reproduction steps or a proof of concept, where safe to provide.
- Any relevant logs, screenshots, or error messages.
- A suggested mitigation, if you have one.

### Response process

- Reports will be acknowledged as soon as reasonably possible.
- The report will be reviewed for validity, severity, affected components, and required mitigation.
- If accepted, the issue will be investigated and a fix or mitigation will be developed and released when practical.
- If declined, the reporter will be given an explanation where appropriate.
- Reporters will be credited in the security advisory or release notes if they request credit and it is safe to do so.

Please allow reasonable time for investigation and remediation before making a vulnerability public.

## Scope

Security reports may include issues involving:

- Authentication, authorization, sessions, and access control.
- File uploads, media processing, and generated output.
- Server endpoints, secrets, payment integrations, and third-party services.
- Cross-site scripting, injection, unsafe deserialization, and other application-security issues.
- GitHub Actions, dependency vulnerabilities, and repository configuration that could expose users or project credentials.

General feature requests, ordinary bugs, performance issues, and requests for support should be opened as GitHub issues instead.

## Security Updates

Security fixes will be published through the repository's normal release or commit process. Users should keep their installation up to date and review security advisories when available.
