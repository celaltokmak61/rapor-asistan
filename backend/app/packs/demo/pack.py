from pathlib import Path
from app.core.config import settings
from app.packs.base import Pack, PackModule, Branch
from app.packs.demo.prompt import build_system_prompt

PACK_DIR = Path(__file__).resolve().parent
DATA_PATH = PACK_DIR / "data" / "commerce.db"


def build_pack() -> Pack:
    default_db = str(DATA_PATH) if DATA_PATH.exists() else (settings.SQLITE_PATH or "demo")
    return Pack(
        id="demo",
        name="Demo Commerce",
        dialect="sqlite",
        default_database=default_db,
        default_firm="MAIN",
        branches=[
            Branch("MAIN", "Head office", "main"),
            Branch("IST", "Istanbul warehouse", "warehouse"),
            Branch("ANK", "Ankara warehouse", "warehouse"),
            Branch("IZM", "Izmir warehouse", "warehouse"),
        ],
        modules=[
            PackModule("ai_studio", "AI Studio", "🤖", "Ask in natural language, get a live report"),
        ],
        databases=[{"id": default_db, "label": "Demo commerce (SQLite)"}],
        product_catalog_sql="SELECT DISTINCT name AS URUN FROM products WHERE status = 1 AND name IS NOT NULL",
        product_catalog_db=default_db,
        seed_dir=PACK_DIR / "seed",
        routers=[],
        exports={},
        build_system_prompt=build_system_prompt,
    )
