# Architecture

```
browser  →  FastAPI  →  pack (demo | generic | optional ERP)
                 │
                 ├─ engine/trainer     natural language → SQL JSON
                 ├─ engine/llm_client  Gemini → Groq → Ollama
                 ├─ engine/schema_*    live catalog + prompt
                 ├─ db/connection      SQLite or MSSQL
                 └─ db/knowledge.db    golden SQL, rules, users
```

## Packs

A pack is one software family’s schema, prompt and seed data.

| Pack | When |
| --- | --- |
| `demo` | Default. Bundled SQLite commerce DB. Clone and ask. |
| `generic` | Your own MSSQL/SQLite. Setup wizard discovers tables. |

Put a new ERP under `backend/app/packs/<name>/` with `pack.py` + `prompt.py`. Do not hard-code table names in the core.

## Safety

`TrainingAgent.validate_sql` parses with sqlglot and rejects anything that is not a `SELECT`.
Golden SQL short-circuits identical questions so the model is not required for the demo path.

## Data flow

1. User asks in AI Studio.
2. Exact golden-SQL hit → run immediately.
3. Else LLM returns JSON `{sql_query, chart_type, report_title}`.
4. SQL is AST-checked, executed, charted, optionally analysed.
