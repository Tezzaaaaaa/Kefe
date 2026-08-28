# Security

## Reporting a vulnerability

Do not disclose security vulnerabilities in a public issue.

Report suspected vulnerabilities privately to the repository owner through GitHub. Include a concise description, affected files or endpoints, reproduction steps, and any relevant logs or proof of concept.

## Secrets

Never commit `.env` files, API keys, Stripe credentials, JWT secrets, database files, or other credentials. Use `.env.example` as the configuration template.

## Production requirements

- Set a strong, unique `JWT_SECRET`.
- Set `NODE_ENV=production`.
- Configure Stripe secrets through the deployment environment.
- Keep runtime database files outside version control.
- Serve the application over HTTPS in production.
