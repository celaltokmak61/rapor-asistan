from datetime import date
from fastapi import APIRouter, HTTPException, Body
from typing import Dict, Any, List, Optional
from app.db.knowledge_db import knowledge_db
from app.db.connection import db_manager
from app.engine.trainer import training_agent
from app.packs.loader import get_pack

router = APIRouter(prefix="/admin/knowledge", tags=["Altın SQL & Kurumsal Hafıza"])

@router.post("/train")
async def train_ai_cockpit(payload: Dict[str, Any] = Body(...)):
    """
    Admin Eğitim Kokpiti: Doğal dille kural, SQL eşlemesi veya soru-cevap öğretir,
    Yapay zekanın kuralı analiz etmesini sağlar ve SQLite hafızasına kaydeder.
    Benzer bir altın sorgu varsa çakışmayı tespit eder ve karşılaştırmalı onay sunar.
    """
    instruction = str(payload.get("instruction", "")).strip()
    force_save = bool(payload.get("force_save", False))
    replace_id = payload.get("replace_id")

    if not instruction and not payload.get("sql_query"):
        raise HTTPException(status_code=400, detail="Eğitim talimatı veya kural metni boş olamaz.")

    try:
        # Eğer doğrudan onaylanan bir SQL ve ID ile güncelleme istenmişse
        if replace_id and payload.get("sql_query"):
            report_title = payload.get("report_title") or "Güncellenen Altın Sorgu"
            sql_query = payload.get("sql_query")
            pack = get_pack()
            target_db = payload.get("target_database") or pack.default_database
            chart_type = payload.get("chart_type", "table")
            explanation = payload.get("explanation", "")
            
            knowledge_db.update_golden_sql(int(replace_id), report_title, sql_query, chart_type, target_db, explanation)
            return {
                "success": True,
                "action_type": "sql_updated",
                "message": f"Mevcut Altın Sorgu (ID: {replace_id}) başarıyla güncellendi.",
                "report_title": report_title,
                "sql_query": sql_query
            }

        res = await training_agent.process_training_input(instruction)
        parsed = res.get("response", {})
        action_type = parsed.get("action_type", "knowledge_learned")
        sql_query = parsed.get("sql_query")
        pack = get_pack()
        target_db = parsed.get("target_database") or pack.default_database
        report_title = parsed.get("report_title", "Öğrenilen Kural")
        explanation = parsed.get("explanation", "")
        learned_note = parsed.get("learned_note")
        conflict_detected = res.get("conflict_detected", False)
        similar_goldens = res.get("similar_goldens", [])
        
        # Canlı MSSQL Testi (Yeni Sorgu)
        preview_data = []
        sql_error = None
        today = date.today()
        s_date = today.replace(day=1).strftime("%Y-%m-%d")
        e_date = today.strftime("%Y-%m-%d")
        if sql_query:
            test_sql = sql_query.replace('{baslangic}', s_date).replace('{bitis}', e_date)
            exec_res = db_manager.execute_query(test_sql, target_db=target_db, max_rows=5)
            if exec_res.get("success"):
                preview_data = exec_res.get("data", [])
            else:
                sql_error = exec_res.get("error")

        # Eğer Benzer Altın Sorgu tespit edildiyse ve zorla kaydetme seçilmediyse
        existing_golden_detail = None
        if conflict_detected and similar_goldens and not force_save:
            first_match = similar_goldens[0]
            existing_sql = first_match.get("sql_query", "")
            existing_preview = []
            if existing_sql:
                test_ex_sql = existing_sql.replace('{baslangic}', s_date).replace('{bitis}', e_date)
                ex_res = db_manager.execute_query(test_ex_sql, target_db=first_match.get("target_database") or pack.default_database, max_rows=5)
                if ex_res.get("success"):
                    existing_preview = ex_res.get("data", [])
            
            existing_golden_detail = {
                "id": first_match.get("id"),
                "soru": first_match.get("soru"),
                "sql_query": existing_sql,
                "aciklama": first_match.get("aciklama"),
                "target_database": first_match.get("target_database") or pack.default_database,
                "similarity_score": first_match.get("similarity_score"),
                "preview_data": existing_preview
            }
        else:
            # Çakışma yoksa veya force_save=True ise Altın SQL olarak kaydet
            if sql_query and not sql_error:
                knowledge_db.add_golden_sql(report_title, sql_query, parsed.get("chart_type", "table"), target_db, explanation)

        return {
            "success": True,
            "action_type": action_type,
            "report_title": report_title,
            "explanation": explanation,
            "learned_note": learned_note,
            "sql_query": sql_query,
            "target_database": target_db,
            "preview_data": preview_data,
            "sql_error": sql_error,
            "conflict_detected": conflict_detected and not force_save,
            "existing_golden": existing_golden_detail,
            "duration_ms": res.get("duration_ms", 0),
            "model": res.get("model", "Rapor-AI Engine")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------------------------------------
# ⭐ ALTIN SQL KURALLARI
# -------------------------------------------------------------

@router.get("/golden")
async def list_golden_sql():
    """Tüm altın SQL sorgularını listeler."""
    return {"success": True, "data": knowledge_db.get_all_golden_sql()}

@router.post("/golden")
async def add_or_update_golden_sql(payload: Dict[str, Any] = Body(...)):
    """Yeni bir altın SQL ekler veya günceller."""
    soru = payload.get("soru", "").strip()
    sql_query = payload.get("sql_query", "").strip()
    chart_type = payload.get("chart_type", "table").strip()
    target_db = (payload.get("target_database") or get_pack().default_database).strip()
    aciklama = payload.get("aciklama", "").strip()

    if not soru or not sql_query:
        raise HTTPException(status_code=400, detail="Soru ve SQL sorgusu zorunludur.")

    msg = knowledge_db.add_golden_sql(soru, sql_query, chart_type, target_db, aciklama)
    return {"success": True, "message": msg}

@router.put("/golden/{golden_id}")
async def update_golden_sql_by_id(golden_id: int, payload: Dict[str, Any] = Body(...)):
    """Mevcut bir altın SQL kuralını günceller."""
    soru = payload.get("soru", "").strip()
    sql_query = payload.get("sql_query", "").strip()
    chart_type = payload.get("chart_type", "table").strip()
    target_db = (payload.get("target_database") or get_pack().default_database).strip()
    aciklama = payload.get("aciklama", "").strip()

    if not soru or not sql_query:
        raise HTTPException(status_code=400, detail="Soru ve SQL sorgusu zorunludur.")

    success = knowledge_db.update_golden_sql(golden_id, soru, sql_query, chart_type, target_db, aciklama)
    if not success:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"success": True, "message": "Altın SQL başarıyla güncellendi."}

@router.delete("/golden/{golden_id}")
async def delete_golden_sql(golden_id: int):
    """Altın SQL kuralını siler."""
    success = knowledge_db.delete_golden_sql(golden_id)
    if not success:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"success": True, "message": "Altın SQL başarıyla silindi."}

# -------------------------------------------------------------
# 🏛️ ŞİRKET DEĞERLERİ & İŞ AHLAKI
# -------------------------------------------------------------

@router.get("/values")
async def list_corporate_values():
    """Tüm aktif şirket değerlerini listeler."""
    return {"success": True, "data": knowledge_db.get_active_corporate_values()}

@router.post("/values")
async def add_corporate_value(payload: Dict[str, Any] = Body(...)):
    """Yeni şirket değeri ekler."""
    title = payload.get("title", "").strip()
    description = payload.get("description", "").strip()
    priority = payload.get("priority", "YÜKSEK").strip()

    if not title or not description:
        raise HTTPException(status_code=400, detail="Başlık ve açıklama zorunludur.")

    val_id = knowledge_db.add_corporate_value(title, description, priority)
    return {"success": True, "id": val_id, "message": "Şirket değeri başarıyla kaydedildi."}

@router.delete("/values/{val_id}")
async def delete_corporate_value(val_id: int):
    """Şirket değerini siler."""
    success = knowledge_db.delete_corporate_value(val_id)
    if not success:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"success": True, "message": "Şirket değeri başarıyla silindi."}

# -------------------------------------------------------------
# ⚖️ İŞ KURALLARI & KÂR/FİRE EŞİKLERİ
# -------------------------------------------------------------

@router.get("/rules")
async def list_business_rules(category: Optional[str] = None):
    """İş kurallarını listeler."""
    return {"success": True, "data": knowledge_db.get_active_business_rules(category)}

@router.post("/rules")
async def add_business_rule(payload: Dict[str, Any] = Body(...)):
    """Yeni iş kuralı ve marj eşiği ekler."""
    category = payload.get("category", "GENEL").strip()
    rule_name = payload.get("rule_name", "").strip()
    rule_text = payload.get("rule_text", "").strip()
    min_margin = payload.get("min_margin_pct")
    max_loss = payload.get("max_loss_pct")
    severity = payload.get("severity", "UYARI").strip()
    action = payload.get("action_recommendation", "").strip()

    if not rule_name or not rule_text:
        raise HTTPException(status_code=400, detail="Kural adı ve metni zorunludur.")

    rule_id = knowledge_db.add_business_rule(
        category=category,
        rule_name=rule_name,
        rule_text=rule_text,
        min_margin=float(min_margin) if min_margin is not None else None,
        max_loss=float(max_loss) if max_loss is not None else None,
        severity=severity,
        action_recommendation=action
    )
    return {"success": True, "id": rule_id, "message": "İş kuralı başarıyla kaydedildi."}

@router.delete("/rules/{rule_id}")
async def delete_business_rule(rule_id: int):
    """İş kuralını siler."""
    success = knowledge_db.delete_business_rule(rule_id)
    if not success:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"success": True, "message": "İş kuralı başarıyla silindi."}

# -------------------------------------------------------------
# 🔍 ANOMALİ VE TEŞHİS REHBERLERİ (PLAYBOOKS)
# -------------------------------------------------------------

@router.get("/playbooks")
async def list_diagnostic_playbooks():
    """Teşhis rehberlerini listeler."""
    return {"success": True, "data": knowledge_db.get_active_diagnostic_playbooks()}

@router.post("/playbooks")
async def add_diagnostic_playbook(payload: Dict[str, Any] = Body(...)):
    """Yeni anomali teşhis rehberi ekler."""
    anomaly_type = payload.get("anomaly_type", "").strip().upper()
    title = payload.get("title", "").strip()
    check_steps = payload.get("check_steps", [])
    root_cause_guide = payload.get("root_cause_guide", "").strip()
    action_template = payload.get("action_template", "").strip()

    if not anomaly_type or not title:
        raise HTTPException(status_code=400, detail="Anomali kodu ve başlık zorunludur.")

    pb_id = knowledge_db.add_diagnostic_playbook(
        anomaly_type=anomaly_type,
        title=title,
        check_steps=check_steps if isinstance(check_steps, list) else [str(check_steps)],
        root_cause_guide=root_cause_guide,
        action_template=action_template
    )
    return {"success": True, "id": pb_id, "message": "Teşhis rehberi başarıyla kaydedildi."}

@router.delete("/playbooks/{pb_id}")
async def delete_diagnostic_playbook(pb_id: int):
    """Teşhis rehberini siler."""
    success = knowledge_db.delete_diagnostic_playbook(pb_id)
    if not success:
        raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
    return {"success": True, "message": "Teşhis rehberi başarıyla silindi."}

# -------------------------------------------------------------
# 🧪 CANLI SQL TEST & NOTLAR
# -------------------------------------------------------------

@router.post("/test-sql")
async def test_sql_query(payload: Dict[str, str] = Body(...)):
    """Bir SQL sorgusunu canlı sunucuda test eder."""
    sql = payload.get("sql", "").strip()
    target_db = (payload.get("target_database") or get_pack().default_database).strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL sorgusu boş olamaz.")
    
    res = db_manager.execute_query(sql, target_db=target_db)
    return res

@router.get("/notes")
async def list_learned_notes():
    """Tüm serbest öğrenilmiş iş kurallarını listeler."""
    return {"success": True, "data": knowledge_db.get_all_learned_notes()}

@router.post("/notes")
async def add_learned_note(payload: Dict[str, str] = Body(...)):
    """Serbest öğrenilmiş not ekler."""
    note = payload.get("note", "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="Not metni boş olamaz.")
    knowledge_db.add_learned_note(note)
    return {"success": True, "message": "Öğrenilmiş not kaydedildi."}

@router.delete("/notes/{note_id}")
async def delete_learned_note(note_id: int):
    """Serbest notu siler."""
    success = knowledge_db.delete_learned_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Not bulunamadı.")
    return {"success": True, "message": "Not başarıyla silindi."}

# -------------------------------------------------------------
# 💡 DİNAMİK ÖNERİLEN & EN ÇOK KULLANILAN SORGULAR (ADMIN)
# -------------------------------------------------------------

@router.get("/frequent-questions")
async def list_frequent_questions():
    """Tüm önerilen ve sık sorulan soruları döner."""
    try:
        items = knowledge_db.get_all_frequent_questions()
        return {"success": True, "count": len(items), "data": items}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/frequent-questions")
async def add_frequent_question(payload: Dict[str, Any] = Body(...)):
    """Yeni soru önerisi ekler."""
    q_text = (payload.get("question_text") or payload.get("question") or "").strip()
    if not q_text:
        raise HTTPException(status_code=400, detail="Soru metni boş olamaz.")
    
    chip_label = payload.get("chip_label")
    category = payload.get("category", "Genel")
    is_pinned = 1 if payload.get("is_pinned") else 0
    ask_count = int(payload.get("ask_count") or 1)

    try:
        q_id = knowledge_db.add_frequent_question(
            question_text=q_text,
            chip_label=chip_label,
            category=category,
            is_pinned=is_pinned,
            ask_count=ask_count
        )
        return {"success": True, "id": q_id, "message": "Soru önerisi başarıyla eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/frequent-questions/{question_id}")
async def update_frequent_question(question_id: int, payload: Dict[str, Any] = Body(...)):
    """Mevcut soru önerisini düzenler."""
    q_text = (payload.get("question_text") or payload.get("question") or "").strip()
    if not q_text:
        raise HTTPException(status_code=400, detail="Soru metni boş olamaz.")
    
    chip_label = payload.get("chip_label")
    category = payload.get("category", "Genel")
    is_pinned = 1 if payload.get("is_pinned") else 0
    ask_count = int(payload.get("ask_count") or 1)

    try:
        updated = knowledge_db.update_frequent_question(
            q_id=question_id,
            question_text=q_text,
            chip_label=chip_label,
            category=category,
            is_pinned=is_pinned,
            ask_count=ask_count
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Güncellenecek soru kaydı bulunamadı.")
        return {"success": True, "id": question_id, "message": "Soru önerisi başarıyla güncellendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/frequent-questions/{question_id}")
async def delete_frequent_question(question_id: int):
    """Soru önerisini siler."""
    try:
        deleted = knowledge_db.delete_frequent_question(question_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Silinecek soru kaydı bulunamadı.")
        return {"success": True, "id": question_id, "message": "Soru önerisi başarıyla silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/frequent-questions/{question_id}/toggle-pin")
async def toggle_pin_frequent_question(question_id: int):
    """Soru önerisinin sabitleme durumunu değiştirir."""
    try:
        is_pinned = knowledge_db.toggle_pin_by_id(question_id)
        return {"success": True, "id": question_id, "is_pinned": is_pinned, "message": "Sabitleme durumu güncellendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

