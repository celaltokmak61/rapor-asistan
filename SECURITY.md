# Security

## Secrets

- `backend/.env` is gitignored. Only `.env.example` is public.
- Never commit API keys or `knowledge.db`.

## SQL

The engine accepts **SELECT only**. `sqlglot` parses the AST and a keyword denylist blocks INSERT/UPDATE/DELETE/DROP/ALTER/PRAGMA/ATTACH.

Still:

- Use a read-only SQL login in production.
- Do not expose port 8000 on the public internet without a reverse proxy.
- Change `admin / admin123` immediately.

## Report a vulnerability

Use GitHub Security Advisories. Do not file a public issue with an exploit.
