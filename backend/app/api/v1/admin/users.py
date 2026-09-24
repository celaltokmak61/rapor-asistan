from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List
from app.db.knowledge_db import knowledge_db

router = APIRouter(prefix="/admin/users", tags=["Kullanıcı & Yetki Yönetimi"])

@router.get("")
async def list_users():
    """Tüm kullanıcıları ve şube yetkilerini listeler."""
    return {"success": True, "users": knowledge_db.get_all_users()}

@router.post("")
async def create_user(payload: Dict[str, Any] = Body(...)):
    """Yeni kullanıcı oluşturur."""
    username = payload.get("username", "").strip()
    password = payload.get("password", "").strip()
    full_name = payload.get("full_name", "").strip()
    role = payload.get("role", "user").strip()
    branch_access = payload.get("branch_access", "ALL").strip()

    if not username or not password or not full_name:
        raise HTTPException(status_code=400, detail="Kullanıcı adı, şifre ve ad-soyad zorunludur.")

    try:
        res = knowledge_db.create_user(username, password, full_name, role, branch_access)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Kullanıcı oluşturulamadı: {str(e)}")

@router.put("/{user_id}")
async def update_user(user_id: int, payload: Dict[str, Any] = Body(...)):
    """Kullanıcının adını, şifresini veya yetki rolünü (admin/user) günceller."""
    full_name = payload.get("full_name")
    password = payload.get("password")
    role = payload.get("role")

    try:
        success = knowledge_db.update_user(user_id, full_name=full_name, password_raw=password, role=role)
        if not success:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı veya güncellenemedi.")
        return {"success": True, "message": "Kullanıcı bilgileri başarıyla güncellendi."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Güncelleme başarısız: {str(e)}")

@router.delete("/{user_id}")
async def delete_user(user_id: int):
    """Kullanıcıyı siler (Admin kullanıcısı silinemez)."""
    success = knowledge_db.delete_user(user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Kullanıcı silinemedi veya admin kullanıcısı silinmeye çalışıldı.")
    return {"success": True, "message": "Kullanıcı başarıyla silindi."}
