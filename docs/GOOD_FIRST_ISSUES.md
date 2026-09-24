# Good first issues

Copy into GitHub Issues after the first public push.

1. **PostgreSQL connection backend** — add `DB_BACKEND=postgres` using `psycopg`. Mirror `connection.py` sqlite/odbc split. Tests against a tiny docker postgres.
2. **JWT login** — replace SHA-256 password compare with passlib + short-lived JWT. Keep the same `/api/v1/auth/login` JSON shape.
3. **PNG screenshots** — replace the SVG mocks in `docs/screenshots/` with real 1280×720 captures from `docker compose up`.
4. **i18n pack for the wizard** — `setup_wizard.js` strings today mix TR/EN. Move copy into a `window.I18N` map with `en` and `tr`.
5. **Golden SQL fuzzy match** — exact string match already works. Add rapidfuzz on `soru` so “sales this month” hits “this month sales by customer”.
