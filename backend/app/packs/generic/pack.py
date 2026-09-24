from app.core.config import settings
from app.packs.base import Pack, PackModule, Branch
from app.packs.generic.prompt import build_system_prompt


def build_pack() -> Pack:
    default_db = settings.DEFAULT_DATABASE or settings.MSSQL_DATABASE or settings.SQLITE_PATH or "DEFAULT"
    default_firm = settings.DEFAULT_FIRM or "MAIN"
    dialect = settings.SQL_DIALECT or ("sqlite" if (settings.DB_BACKEND or "").lower() == "sqlite" else "tsql")
    return Pack(
        id="generic",
        name=settings.APP_NAME or "Rapor Asistan",
        dialect=dialect,
        default_database=default_db,
        default_firm=default_firm,
        branches=[
            Branch(default_firm, "Ana Firma", "main"),
        ],
        modules=[
            PackModule("ai_studio", "AI Stüdyosu", "🤖", "Doğal dille rapor üretimi"),
        ],
        databases=[{"id": default_db, "label": "Varsayılan veritabanı"}],
        product_catalog_sql="",
        product_catalog_db=default_db,
        seed_dir=None,
        routers=[],
        exports={},
        build_system_prompt=build_system_prompt,
    )
