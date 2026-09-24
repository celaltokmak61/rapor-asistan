from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any
from app.db.knowledge_db import knowledge_db

router = APIRouter(prefix="/admin/preferences", tags=["Admin Tercihleri & İki Yönlü Eşitleme"])

@router.get("")
async def get_preferences():
    """Tüm dinamik UI ve AI tercihlerini döner."""
    return {"success": True, "preferences": knowledge_db.get_all_preferences()}

@router.post("/column")
async def update_column_name(payload: Dict[str, str] = Body(...)):
    """
    Kolon isimlendirmesini günceller.
    Örn: {"db_column": "MALINCINSI", "display_name": "Malın Cinsi"}
    Hem tablolardaki başlığı hem de AI SQL promptunu senkronize eder.
    """
    db_col = payload.get("db_column", "").strip().upper()
    display_name = payload.get("display_name", "").strip()
    if not db_col or not display_name:
        raise HTTPException(status_code=400, detail="db_column ve display_name zorunludur.")
    
    knowledge_db.save_preference("kolon_isimlendirmeleri", db_col, display_name)
    return {"success": True, "message": f"{db_col} kolonu artık '{display_name}' olarak gösterilecek ve AI tarafından eşlenecektir."}

@router.post("/role")
async def update_field_role(payload: Dict[str, str] = Body(...)):
    """
    Alan rolünü günceller.
    Örn: {"field_code": "KOD20", "role_name": "Şube Reyonu"}
    """
    field_code = payload.get("field_code", "").strip().upper()
    role_name = payload.get("role_name", "").strip()
    if not field_code or not role_name:
        raise HTTPException(status_code=400, detail="field_code ve role_name zorunludur.")
    
    knowledge_db.save_preference("alan_rolleri", field_code, role_name)
    # AI kuralına da otomatik ekle
    knowledge_db.add_learned_note(f"Veritabanında {field_code} alanı '{role_name}' anlamında kullanılmaktadır.")
    return {"success": True, "message": f"{field_code} alanı '{role_name}' rolü ile eşlendi."}
