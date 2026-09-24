import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
os.environ.setdefault("ACTIVE_PACK", "demo")
os.environ.setdefault("DB_BACKEND", "sqlite")
os.environ.setdefault("SQL_DIALECT", "sqlite")
os.environ.setdefault("GEMINI_API_KEY", "")
os.environ.setdefault("GROQ_API_KEY", "")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin123")
os.environ.setdefault(
    "SQLITE_PATH",
    str(BACKEND / "app" / "packs" / "demo" / "data" / "commerce.db"),
)
os.environ.setdefault(
    "KNOWLEDGE_DB_PATH",
    str(BACKEND / "app" / "db" / "demo-knowledge.db"),
)

sys.path.insert(0, str(BACKEND))
