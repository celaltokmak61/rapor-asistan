# Contributing

Core code (`engine/`, `api/`, `static/` minus pack JS) must not contain a vendor table name.

## Dev

```bash
python -m pip install -r backend/requirements.txt
python backend/app/packs/demo/data/build_demo_db.py
cd backend
python -m pytest tests -q
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## PR checklist

- [ ] `pytest` green
- [ ] no secrets / `knowledge.db`
- [ ] ERP-specific SQL lives in a pack, not core
- [ ] new user-facing strings have a TR or EN counterpart in the UI they touch

Good first issues are tagged `good first issue`.
