from fastapi import APIRouter, HTTPException, Body, Query
from typing import Any, Dict, List, Optional
from app.core.config import settings
from app.db.connection import db_manager
from app.db.knowledge_db import knowledge_db
from app.engine import schema_discovery
from app.packs.loader import get_pack
from app.packs.seeder import seed_pack

router = APIRouter(prefix="/setup", tags=["Kurulum & Şema Keşfi"])


@router.get("/status")
async def setup_status():
    pack = get_pack()
    status = schema_discovery.bootstrap_status()
    db_test = db_manager.test_connection()
    return {
        "success": True,
        "app": {
            "name": settings.APP_NAME,
            "tagline": settings.APP_TAGLINE,
            "assistant": settings.ASSISTANT_NAME,
            "version": settings.APP_VERSION,
        },
        "pack": {
            "id": pack.id,
            "name": pack.name,
            "dialect": pack.dialect,
            "default_database": pack.default_database,
            "default_firm": pack.default_firm,
            "modules": [m.__dict__ for m in pack.modules],
            "branches": [b.__dict__ for b in pack.branches],
            "databases": pack.databases,
        },
        "database": db_test,
        **status,
    }


@router.get("/bootstrap")
async def public_bootstrap():
    pack = get_pack()
    status = schema_discovery.bootstrap_status()
    app_name = knowledge_db.get_preference("branding", "app_name") or settings.APP_NAME
    assistant = knowledge_db.get_preference("branding", "assistant_name") or settings.ASSISTANT_NAME
    firms = knowledge_db.get_schema_knowledge(entity_type="firma")
    branches = [b.__dict__ for b in pack.branches]
    if firms:
        branches = [
            {
                "code": f.get("code_or_name"),
                "name": (f.get("description") or f.get("code_or_name") or "").split(" - ")[0],
                "role": (f.get("details") or {}).get("role", "branch") if isinstance(f.get("details"), dict) else "branch",
            }
            for f in firms
            if f.get("code_or_name")
        ]
    return {
        "success": True,
        "app_name": app_name,
        "tagline": settings.APP_TAGLINE,
        "assistant_name": assistant,
        "pack_id": pack.id,
        "pack_name": pack.name,
        "modules": [m.__dict__ for m in pack.modules],
        "branches": branches,
        "databases": pack.databases,
        "setup_complete": status["setup_complete"] or pack.id == "demo",
        "needs_wizard": (not status["setup_complete"]) and pack.id not in ("demo",),
    }


@router.post("/connection")
async def save_connection(payload: Dict[str, Any] = Body(...)):
    server = (payload.get("server") or "").strip()
    database = (payload.get("database") or "").strip()
    user = (payload.get("user") or "").strip()
    password = payload.get("password") or ""
    driver = (payload.get("driver") or settings.MSSQL_DRIVER).strip()
    if not server or not database:
        raise HTTPException(status_code=400, detail="Sunucu ve veritabanı adı zorunludur.")

    settings.MSSQL_SERVER = server
    settings.MSSQL_DATABASE = database
    settings.MSSQL_USER = user
    settings.MSSQL_PASSWORD = password
    settings.MSSQL_DRIVER = driver
    settings.DEFAULT_DATABASE = database
    db_manager.server = server
    db_manager.database = database
    db_manager.user = user
    db_manager.password = password
    db_manager.driver = driver

    test = db_manager.test_connection(target_db=database)
    if not test.get("success"):
        raise HTTPException(status_code=400, detail=f"Bağlantı başarısız: {test.get('error')}")
    knowledge_db.save_preference("connection", "password_set", "1" if password else "0")

    knowledge_db.save_preference("connection", "server", server)
    knowledge_db.save_preference("connection", "database", database)
    knowledge_db.save_preference("connection", "user", user)
    knowledge_db.save_preference("connection", "driver", driver)
    return {"success": True, "database": test}


@router.get("/tables")
async def list_tables(target_db: Optional[str] = Query(None)):
    res = schema_discovery.list_tables(target_db=target_db)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error") or "Tablo listesi alınamadı.")
    return res


@router.get("/tables/{table_name}")
async def describe_table(table_name: str, target_db: Optional[str] = Query(None)):
    res = schema_discovery.describe_table(table_name, target_db=target_db)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error") or "Tablo bulunamadı.")
    return res


@router.get("/tables/{table_name}/sample")
async def sample_table(table_name: str, target_db: Optional[str] = Query(None), limit: int = Query(5)):
    return schema_discovery.sample_rows(table_name, target_db=target_db, limit=min(limit, 50))


@router.post("/ingest-tables")
async def ingest_tables(payload: Dict[str, Any] = Body(...)):
    tables = payload.get("tables") or []
    target_db = payload.get("target_database")
    if not tables:
        raise HTTPException(status_code=400, detail="En az bir tablo seçilmelidir.")
    return schema_discovery.ingest_tables(tables, target_db=target_db)


@router.post("/firm")
async def add_firm(payload: Dict[str, str] = Body(...)):
    code = (payload.get("code") or "").strip()
    name = (payload.get("name") or "").strip()
    role = (payload.get("role") or "branch").strip()
    if not code or not name:
        raise HTTPException(status_code=400, detail="Firma kodu ve adı zorunludur.")
    knowledge_db.save_schema_knowledge(
        entity_type="firma",
        code_or_name=code,
        description=f"{name} ({role})",
        details={"ad": name, "role": role},
    )
    return {"success": True, "code": code, "name": name}


@router.post("/teach")
async def teach_rule(payload: Dict[str, str] = Body(...)):
    note = (payload.get("note") or payload.get("rule") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="Kural metni boş olamaz.")
    knowledge_db.add_learned_note(note)
    return {"success": True, "message": "Kural kurumsal hafızaya işlendi."}


@router.post("/complete")
async def complete_setup(payload: Dict[str, Any] = Body(default={})):
    app_name = (payload.get("app_name") or settings.APP_NAME).strip()
    assistant = (payload.get("assistant_name") or settings.ASSISTANT_NAME).strip()
    knowledge_db.save_preference("branding", "app_name", app_name)
    knowledge_db.save_preference("branding", "assistant_name", assistant)
    knowledge_db.save_preference("system", "setup_complete", "1")
    settings.APP_NAME = app_name
    settings.ASSISTANT_NAME = assistant
    settings.SETUP_COMPLETE = True
    return {"success": True, "app_name": app_name, "assistant_name": assistant}


@router.post("/seed-pack")
async def seed_active_pack(force: bool = False):
    return seed_pack(force=force)
