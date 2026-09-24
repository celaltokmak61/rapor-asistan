import re
from fastapi import APIRouter, HTTPException, Body, Query
from typing import Dict, Any, Optional, List
from app.engine.trainer import training_agent
from app.engine.llm_client import llm_client
from app.db.connection import db_manager
from app.db.knowledge_db import knowledge_db

router = APIRouter(tags=["Omni-AI Copilot & Query Engine"])

@router.post("/chat")
@router.post("/query")
async def ask_copilot(payload: Dict[str, Any] = Body(...)):
    """
    🌟 ÇİFT KADEMELİ STRATEJİK YAPAY ZEKA VE RAPORLAMA MOTORU:
    1. Aşama: Soruyu SQL'e çevirip canlı MSSQL veritabanından veriyi çeker.
    2. Aşama: Şirket değerleri, kâr marjları ve teşhis rehberleri ile derin analiz üretir.
    3. Aşama: Oturum geçmişini ve analizi SQLite veritabanına kaydeder.
    """
    user_input = payload.get("message") or payload.get("query") or ""
    user_input = user_input.strip()
    from app.packs.loader import get_pack
    pack = get_pack()
    active_firm = payload.get("active_firm") or payload.get("firm_code") or pack.default_firm
    start_date = payload.get("start_date")
    end_date = payload.get("end_date")
    session_id = payload.get("session_id") or "default_session"
    user_name = payload.get("user_name") or "Yönetici"

    if not user_input:
        raise HTTPException(status_code=400, detail="Mesaj veya soru boş olamaz.")

    # 📦 1. Yönetici Paketi / Toplu Excel İndirme Niyeti Tespiti
    norm_input = user_input.lower().strip()
    is_package_intent = bool(re.search(
        r'\b(toplu|yönetici\s*paket|sekmeli\s*excel|birleşik\s*excel|üçünü\s*birden|hepsini\s*tek\s*excel|tümünü\s*tek\s*excel)\b',
        norm_input
    ))
    if False and is_package_intent:
        return {
            "success": True,
            "action_type": "export_executive_package",
            "report_title": "👑 Yönetici Paketi (3 Sekmeli Tek Excel)",
            "explanation": "Tüm raporlar tek bir Excel dosyasında 3 ayrı sekme olarak hazırlandı.",
            "download_url": "/api/v1/export/executive-package",
            "model": "Rapor-AI Engine",
            "duration_ms": 10
        }

    # 📥 2. Tekil Excel / Rapor İndirme Niyeti Tespiti
    is_export_intent = bool(re.search(r'\b(excel\s*(indir|aktar|al|ver|çıkar)|excele\s*(aktar|indir)|exceli\s*(indir|aktar)|indir|tabloyu\s*(indir|aktar)|raporu\s*(indir|aktar))\b', norm_input)) or (norm_input == "excel")
    if is_export_intent:
        return {
            "success": True,
            "action_type": "export_excel",
            "report_title": "Excel Dışa Aktarma",
            "explanation": "Tablodaki veriler Excel (.xlsx) formatında hazırlanıp indirilmek üzere yönlendirildi.",
            "model": "Rapor-AI Engine",
            "duration_ms": 10
        }

    try:
        # 🤖 Dinamik Yönetici Soruları Frekans Kaydı
        try:
            knowledge_db.record_question(user_input)
        except Exception:
            pass

        # Oturum geçmişini al
        history = knowledge_db.get_session_history(session_id, limit=6)

        # 1. Aşama: Çok Katmanlı Yapay Zeka ile SQL ve Rapor Üret
        ai_res = await training_agent.process_training_input(
            user_input, 
            active_firm=active_firm, 
            start_date=start_date, 
            end_date=end_date
        )
        
        parsed = ai_res.get("response", {})
        action_type = parsed.get("action_type", "sql_query")
        report_title = parsed.get("report_title") or parsed.get("explanation") or "AI Rapor Çıktısı"
        sql_query = parsed.get("sql_query")
        chart_type = parsed.get("chart_type", "table")
        target_db = parsed.get("target_database") or pack.default_database
        explanation = parsed.get("explanation", "")
        model_name = ai_res.get("model", "Rapor-AI Engine")
        duration_ms = ai_res.get("duration_ms", 0)

        # 2. Eğer Kural Öğrenildiyse
        if action_type == "knowledge_learned":
            knowledge_db.save_chat_message(
                session_id=session_id,
                role="user",
                content=user_input
            )
            resp_text = explanation or "Kural ve tercih kurumsal hafızaya başarıyla işlendi."
            knowledge_db.save_chat_message(
                session_id=session_id,
                role="assistant",
                content=resp_text,
                report_title="Kurumsal Kural Öğrenildi"
            )
            return {
                "success": True,
                "action_type": "knowledge_learned",
                "report_title": "Kurumsal Kural Öğrenildi",
                "explanation": resp_text,
                "model": model_name,
                "duration_ms": duration_ms
            }

        # 3. Eğer SQL Üretildiyse Canlı MSSQL'de Çalıştır
        if sql_query:
            # Tarih parametrelerini dinamik olarak yerine koy
            from datetime import date
            today = date.today()
            s_date = start_date or today.replace(day=1).strftime("%Y-%m-%d")
            e_date = end_date or today.strftime("%Y-%m-%d")
            exec_sql = sql_query.replace('{baslangic}', s_date).replace('{bitis}', e_date)

            exec_res = db_manager.execute_query(exec_sql, target_db=target_db)
            if not exec_res.get("success"):
                error_msg = f"Sorgu üretildi ancak veritabanında çalıştırılırken hata alındı: {exec_res.get('error')}"
                return {
                    "success": False,
                    "action_type": "sql_query",
                    "report_title": report_title,
                    "sql_query": exec_sql,
                    "error": exec_res.get("error"),
                    "explanation": error_msg,
                    "model": model_name,
                    "duration_ms": duration_ms
                }

            rows = exec_res.get("data", [])

            # 4. Aşama: 2. Kademe Stratejik Analiz ve Teşhis Üret
            strategic_res = await llm_client.analyze_data_strategically(
                user_query=user_input,
                report_title=report_title,
                data_rows=rows,
                session_history=history,
                active_firm=active_firm,
                start_date=s_date,
                end_date=e_date
            )
            strategic_insight = strategic_res.get("insight", explanation)

            # 5. Mesajları ve Raporu SQLite Kalıcı Hafızaya Kaydet
            knowledge_db.save_chat_message(
                session_id=session_id,
                role="user",
                content=user_input
            )
            knowledge_db.save_chat_message(
                session_id=session_id,
                role="assistant",
                content=strategic_insight,
                report_title=report_title,
                sql_executed=sql_query,
                summary_data=rows[:10],
                strategic_insight=strategic_insight
            )

            return {
                "success": True,
                "action_type": "sql_query",
                "report_title": report_title,
                "sql_query": sql_query,
                "chart_type": chart_type,
                "target_database": target_db,
                "explanation": strategic_insight,
                "strategic_insight": strategic_insight,
                "model": model_name,
                "analyst_model": strategic_res.get("model", model_name),
                "duration_ms": duration_ms,
                "total_rows": len(rows),
                "data": rows
            }

        return {
            "success": False,
            "error": "Sorgu üretilemedi.",
            "explanation": explanation
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/chat/history")
@router.get("/query/history")
async def get_chat_history(session_id: str = Query("default_session", description="Oturum ID")):
    """Kalıcı SQLite sohbet geçmişini getirir."""
    try:
        history = knowledge_db.get_session_history(session_id, limit=30)
        return {
            "success": True,
            "session_id": session_id,
            "count": len(history),
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/chat/history")
@router.delete("/query/history")
async def clear_chat_history(session_id: str = Query("default_session", description="Oturum ID")):
    """Kullanıcının isteğiyle sohbet hafızasını sıfırlar."""
    try:
        knowledge_db.clear_session_history(session_id)
        return {
            "success": True,
            "message": "Sohbet hafızası başarıyla sıfırlandı."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# =========================================================================
# 🤖 DİNAMİK PATRON YÖNETİCİ SORULARI & AKILLI ÇİPLER
# =========================================================================
@router.get("/chat/dynamic-presets")
@router.get("/query/dynamic-presets")
async def get_dynamic_presets(limit: int = Query(6, description="Maksimum çip sayısı")):
    """Patronun o ay en çok sorduğu ve sabitlediği dinamik soru çiplerini döner."""
    try:
        safe_limit = int(limit) if (isinstance(limit, (int, str)) and not hasattr(limit, 'default')) else 6
        presets = knowledge_db.get_dynamic_preset_questions(limit=safe_limit)
        return {
            "success": True,
            "count": len(presets),
            "presets": presets
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/chat/pin-preset")
@router.post("/query/pin-preset")
async def toggle_pin_preset(payload: Dict[str, Any] = Body(...)):
    """Patronun sevdiği bir soruyu üst çip olarak sabitlemesini veya kaldırmasını sağlar."""
    question_text = (payload.get("question_text") or payload.get("question") or "").strip()
    if not question_text:
        raise HTTPException(status_code=400, detail="Soru metni belirtilmelidir.")
    try:
        is_pinned = knowledge_db.toggle_pin_question(question_text, pinned=payload.get("pinned"))
        return {
            "success": True,
            "question_text": question_text,
            "is_pinned": is_pinned,
            "message": "Soru çipi başarıyla sabitlendi." if is_pinned else "Soru çip sabitlemesi kaldırıldı."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
