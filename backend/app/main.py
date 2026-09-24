from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import settings
from app.db.knowledge_db import knowledge_db
from app.engine.schema_manager import schema_manager
from app.engine.trainer import training_agent
from app.packs.loader import get_pack
from app.packs.seeder import seed_pack

from app.api.v1.admin.preferences import router as preferences_router
from app.api.v1.admin.users import router as users_router
from app.api.v1.admin.knowledge import router as knowledge_router
from app.api.v1.chat import router as chat_router
from app.api.v1.auth import router as auth_router
from app.api.v1.search import router as search_router
from app.api.v1.export import router as export_router
from app.api.v1.setup import router as setup_router

pack = get_pack()
try:
    if pack.seed_dir:
        seed_pack(pack)
except Exception:
    pass

branded_name = settings.APP_NAME

app = FastAPI(
    title=branded_name,
    version=settings.APP_VERSION,
    description=settings.APP_TAGLINE,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(setup_router, prefix=API_PREFIX)
app.include_router(preferences_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(knowledge_router, prefix=API_PREFIX)
app.include_router(chat_router, prefix=API_PREFIX)
app.include_router(search_router, prefix=API_PREFIX)
app.include_router(export_router, prefix=API_PREFIX)

for pack_router in pack.routers:
    app.include_router(pack_router, prefix=API_PREFIX)

_ = (knowledge_db, schema_manager, training_agent)


@app.get("/api/v1/metrics")
def get_metrics():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "pack": pack.id,
        "version": settings.APP_VERSION,
    }


STATIC_DIR = Path(__file__).resolve().parent / "static"
if not STATIC_DIR.exists():
    STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"status": "online", "message": f"{settings.APP_NAME} API aktif"}


@app.get("/admin")
def serve_admin():
    admin_file = STATIC_DIR / "admin.html"
    if admin_file.exists():
        return FileResponse(admin_file)
    return {"status": "online", "message": "Admin paneli hazırlanıyor"}


@app.get("/login")
def serve_login():
    login_file = STATIC_DIR / "login.html"
    if login_file.exists():
        return FileResponse(login_file)
    return {"status": "online", "message": "Giriş ekranı hazırlanıyor"}
