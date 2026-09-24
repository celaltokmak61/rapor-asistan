#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python -m pip install -r backend/requirements.txt
python backend/app/packs/demo/data/build_demo_db.py
export PYTHONPATH="$PWD/backend"
export ACTIVE_PACK="${ACTIVE_PACK:-demo}"
export DB_BACKEND="${DB_BACKEND:-sqlite}"
export SQL_DIALECT="${SQL_DIALECT:-sqlite}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir backend
