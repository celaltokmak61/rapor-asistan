from fastapi import APIRouter, Query
from typing import List, Dict, Any
from app.engine.fuzzy_matcher import fuzzy_matcher

router = APIRouter(prefix="/search", tags=["Akıllı Arama & Öneri Motoru"])

@router.get("/suggest")
async def get_suggestions(
    q: str = Query(..., description="Aranan kelime veya hatalı yazım (Örn: 'çelekli mag')"),
    limit: int = Query(5, description="Maksimum öneri sayısı")
):
    """
    Kullanıcı yazarken veya soru sorarken gerçek stok listesinden
    harf hatalarını düzelterek en yakın ürünleri döner.
    """
    suggestions = fuzzy_matcher.find_suggestions(q, limit=limit)
    return {
        "success": True,
        "query": q,
        "suggestions": suggestions
    }
