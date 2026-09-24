import json
import re
from typing import Dict, Any, Optional, List, Tuple
import sqlglot
from sqlglot.expressions import Select
from app.engine.schema_manager import schema_manager
from app.engine.llm_client import llm_client

class TrainingAgent:
    def __init__(self):
        self.schema = schema_manager
        self.history: List[Dict[str, str]] = []

    def reset_history(self):
        self.history = []

    def validate_sql(self, sql_query: str) -> Dict[str, Any]:
        if not sql_query or not sql_query.strip():
            return {"valid": True, "sql": ""}
        try:
            from app.packs.loader import get_pack
            dialect = get_pack().dialect or "tsql"
            read_dialect = "sqlite" if dialect in ("sqlite", "sqlite3") else dialect
            parsed = sqlglot.parse_one(sql_query, read=read_dialect)
            lowered = sql_query.lower()
            banned = (" insert ", " update ", " delete ", " drop ", " alter ", " attach ", " pragma ", " exec ", " merge ")
            padded = f" {lowered} "
            if any(tok in padded for tok in banned) or lowered.lstrip().startswith(("insert", "update", "delete", "drop", "alter", "pragma", "attach")):
                return {"valid": False, "error": "Güvenlik ihlali: Yalnızca SELECT sorgularına izin verilir."}
            if not isinstance(parsed, Select):
                return {"valid": False, "error": "Güvenlik ihlali: Yalnızca SELECT sorgularına izin verilir."}
            return {"valid": True, "sql": sql_query}
        except Exception as e:
            return {"valid": False, "error": f"SQL AST Hatası: {str(e)}"}

    async def process_training_input(self, user_input: str, active_firm: Optional[str] = None, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        from app.packs.loader import get_pack
        pack = get_pack()
        active_firm = active_firm or pack.default_firm or "MAIN"
        input_clean = user_input.strip().lower()

        # 1. BİREBİR ALTIN KURAL EŞLEŞMESİ (Tam eşleşen onaylı sorgular için anında 1ms yanıt)
        goldens = self.schema.get_golden_data()
        for g in goldens:
            g_soru = g.get("soru", "").strip().lower()
            if g_soru and g_soru == input_clean:
                sql_q = g.get("sql_query", "")
                target_db = g.get("target_database") or pack.default_database
                chart_type = g.get("chart_type", "table")
                explanation = f"⭐ [Hafızadan Çağrıldı] {g.get('aciklama') or g.get('soru')}"

                self.history.append({"role": "user", "content": user_input})
                self.history.append({"role": "assistant", "content": json.dumps({"sql_query": sql_q, "explanation": explanation, "target_database": target_db, "chart_type": chart_type}, ensure_ascii=False)})

                return {
                    "success": True,
                    "user_input": user_input,
                    "response": {
                        "action_type": "sql_query",
                        "report_title": g.get("aciklama") or g.get("soru") or "Canlı Rapor Çıktısı",
                        "target_database": target_db,
                        "sql_query": sql_q,
                        "chart_type": chart_type,
                        "explanation": explanation
                    },
                    "learned_message": None,
                    "validation": {"valid": True},
                    "duration_ms": 1.0,
                    "model": "SQLite Golden SQL Cache (Instant 0.01s)"
                }

        # 2. GENEL SORGULAR VE ÇIKARIMLAR İÇİN DİNAMİK YAPAY ZEKA DÜŞÜNME MOTORU
        system_prompt = self.schema.build_system_prompt(user_query=user_input, active_firm=active_firm, start_date=start_date, end_date=end_date)
        messages = [{"role": "system", "content": system_prompt}]
        
        # Geçmişi token sınırını aşmayacak şekilde kompakt tut (Son 4 mesaj)
        for msg in self.history[-4:]:
            content_trimmed = str(msg.get("content") or "")
            if len(content_trimmed) > 800:
                content_trimmed = content_trimmed[:800] + "... (kısaltıldı)"
            messages.append({"role": msg.get("role", "user"), "content": content_trimmed})
            
        messages.append({"role": "user", "content": user_input})

        res = await llm_client.chat(messages=messages, format_json=True)
        if not res.get("success"):
            return self._fallback_knowledge_handler(user_input, res.get("error", "LLM bağlantısı kurulamadı."))

        raw_content = res.get("content", "").strip()
        try:
            parsed_json = json.loads(raw_content)
        except Exception:
            match = re.search(r'\{.*\}', raw_content, re.DOTALL)
            if match:
                try:
                    parsed_json = json.loads(match.group(0))
                except Exception:
                    parsed_json = {"explanation": raw_content, "sql_query": None, "action_type": "knowledge_learned"}
            else:
                parsed_json = {"explanation": raw_content, "sql_query": None, "action_type": "knowledge_learned"}

        if isinstance(parsed_json, list):
            parsed_json = parsed_json[0] if parsed_json else {"explanation": raw_content, "sql_query": None, "action_type": "knowledge_learned"}

        if not isinstance(parsed_json, dict):
            parsed_json = {"explanation": str(parsed_json), "sql_query": None, "action_type": "knowledge_learned"}

        # Esnek Anahtar Eşleme (sql vs sql_query, thoughts vs explanation)
        sql_query = parsed_json.get("sql_query") or parsed_json.get("sql") or parsed_json.get("query")
        explanation = parsed_json.get("explanation") or parsed_json.get("thoughts") or parsed_json.get("aciklama") or parsed_json.get("description") or ""
        chart_type = parsed_json.get("chart_type") or parsed_json.get("display_type") or "table"
        target_db = parsed_json.get("target_database") or parsed_json.get("target_db") or pack.default_database
        
        # 🏷️ Akıllı ve Profesyonel Rapor Başlığı
        report_title = parsed_json.get("report_title") or parsed_json.get("title") or parsed_json.get("rapor_basligi")
        if not report_title or len(report_title.strip()) < 5 or report_title.strip() == user_input.strip():
            # Kullanıcının ham mesajı yerine akıllı başlık üret
            clean_title = user_input.strip()
            if "dağıtım" in clean_title.lower() or "sevk" in clean_title.lower():
                report_title = "Sipariş Dağıtım (Sevk) Matrisi Raporu"
            elif "mutabakat" in clean_title.lower() or "sayım" in clean_title.lower():
                report_title = "Stok Sayım Mutabakatı ve Olması Gereken Stok Raporu"
            elif "envanter" in clean_title.lower() or "stok" in clean_title.lower():
                report_title = f"{active_firm} Canlı Depo Envanter ve Stok Raporu"
            elif "satış" in clean_title.lower() or "ciro" in clean_title.lower():
                report_title = f"{active_firm} Satış ve Ciro Raporu"
            else:
                report_title = clean_title.capitalize()

        parsed_json["report_title"] = report_title
        parsed_json["sql_query"] = sql_query
        parsed_json["explanation"] = explanation
        parsed_json["chart_type"] = chart_type
        parsed_json["target_database"] = target_db

        learned_note = parsed_json.get("learned_note")
        learned_msg = None
        if learned_note and str(learned_note).strip().lower() not in ["null", "none", ""]:
            self.schema.add_behavioral_rule(str(learned_note).strip())
            learned_msg = f"SQLite veritabanına yeni kural olarak işlendi: {learned_note}"

        if sql_query and (str(sql_query).strip().lower() in ["null", "none", ""] or parsed_json.get("action_type") == "knowledge_learned"):
            sql_query = None
            parsed_json["sql_query"] = None

        validation = {"valid": True}
        if sql_query:
            validation = self.validate_sql(sql_query)

        # 🔍 Benzer / Çakışan Altın SQL Tespiti (Similarity Conflict Check)
        similar_goldens = []
        if sql_query:
            similar_goldens = self.schema.db.find_similar_golden_sql(report_title, sql_query=sql_query, threshold=0.55)

        self.history.append({"role": "user", "content": user_input})
        self.history.append({"role": "assistant", "content": raw_content})

        return {
            "success": True,
            "user_input": user_input,
            "response": parsed_json,
            "learned_message": learned_msg,
            "validation": validation,
            "similar_goldens": similar_goldens,
            "conflict_detected": len(similar_goldens) > 0,
            "duration_ms": res.get("total_duration_ms", 0),
            "model": llm_client.current_model
        }

    def _fallback_knowledge_handler(self, user_input: str, error_detail: str) -> Dict[str, Any]:
        firmalar = self.schema.get_firmalar()
        izahatlar = self.schema.get_izahat_kodlari()
        input_upper = user_input.upper()
        matches = []
        for f in firmalar:
            code = f['code_or_name']
            if code in input_upper:
                matches.append(f"• **{code}**: {f['description']}")

        for i in izahatlar:
            code = i['code_or_name']
            if f"IZAHAT {code}" in input_upper or f"İZAHAT {code}" in input_upper or f"{code} " in input_upper:
                matches.append(f"• **İzahat {code}**: {i['description']}")

        if matches:
            explanation = "Evet, bu bilgiyi ve tablo yapısını çok iyi biliyorum! Hafızamdaki kayıtlar:\n" + "\n".join(matches)
        else:
            explanation = f"Girdinizi aldım. (Yerel kural motoru: {error_detail})"

        return {
            "success": True,
            "user_input": user_input,
            "response": {
                "action_type": "knowledge_learned",
                "sql_query": None,
                "chart_type": "text",
                "explanation": explanation
            },
            "validation": {"valid": True},
            "duration_ms": 1.0,
            "model": "Kural Tabanlı SQLite Şema Motoru"
        }

training_agent = TrainingAgent()
