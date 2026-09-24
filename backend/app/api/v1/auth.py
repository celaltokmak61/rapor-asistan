from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from app.db.knowledge_db import knowledge_db

router = APIRouter(prefix="/auth", tags=["Kimlik Doğrulama"])

@router.post("/login")
async def login(payload: Dict[str, str] = Body(...)):
    """Kullanıcı adı ve şifre ile giriş yapar, rol ve şube yetkilerini döner."""
    username = payload.get("username", "").strip()
    password = payload.get("password", "").strip()

    if not username or not password:
        raise HTTPException(status_code=400, detail="Kullanıcı adı ve şifre zorunludur.")

    user = knowledge_db.authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Hatalı kullanıcı adı veya şifre.")

    return {
        "success": True,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "role": user["role"],
            "branch_access": user["branch_access"]
        }
    }
