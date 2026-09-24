from datetime import datetime
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.db.knowledge_db import knowledge_db
from app.packs.base import PromptContext
from app.packs.loader import get_pack


class SchemaManager:
    def __init__(self):
        self.db = knowledge_db

    def reload(self):
        pass

    def get_firmalar(self) -> List[Dict[str, Any]]:
        rows = self.db.get_schema_knowledge(entity_type="firma")
        if rows:
            return rows
        pack = get_pack()
        return [
            {
                "code_or_name": b.code,
                "entity_key": b.code,
                "description": f"{b.name} ({b.role})",
            }
            for b in pack.branches
        ]

    def get_izahat_kodlari(self) -> List[Dict[str, Any]]:
        return self.db.get_schema_knowledge(entity_type="izahat")

    def add_golden_sql(
        self,
        soru: str,
        sql_query: str,
        chart_type: str = "table",
        target_db: Optional[str] = None,
        aciklama: str = "",
    ) -> str:
        pack = get_pack()
        return self.db.add_golden_sql(
            soru,
            sql_query,
            chart_type,
            target_db or pack.default_database or settings.DEFAULT_DATABASE or "DEFAULT",
            aciklama,
        )

    def save_preference(self, category: str, key: str, value: Any):
        self.db.save_preference(category, key, str(value))

    def add_behavioral_rule(self, rule_text: str):
        self.db.add_learned_note(rule_text)

    def get_preferences(self) -> Dict[str, Any]:
        return self.db.get_all_preferences()

    def get_golden_data(self) -> List[Dict[str, Any]]:
        return self.db.get_all_golden_sql()

    def get_relevant_golden_examples(
        self, user_query: Optional[str] = None, max_examples: int = 4
    ) -> List[Dict[str, Any]]:
        all_goldens = self.db.get_all_golden_sql()
        if not all_goldens:
            return []

        if not user_query or not user_query.strip():
            short_goldens = [g for g in all_goldens if len(g.get("sql_query", "")) < 300]
            return short_goldens[-max_examples:] if short_goldens else all_goldens[-max_examples:]

        q_lower = user_query.strip().lower()
        q_words = set(q_lower.split())

        scored = []
        for g in all_goldens:
            score = 0
            g_soru = g.get("soru", "").lower()
            g_sql = g.get("sql_query", "").lower()
            g_desc = (g.get("aciklama") or "").lower()

            for w in q_words:
                if len(w) > 2:
                    if w in g_soru:
                        score += 3
                    if w in g_desc:
                        score += 2
                    if w in g_sql:
                        score += 1

            if len(g.get("sql_query", "")) > 1000 and score < 5:
                score -= 10

            scored.append((score, g))

        scored.sort(key=lambda x: x[0], reverse=True)
        relevant = [item[1] for item in scored[:max_examples] if item[0] > 0]

        if not relevant:
            short_goldens = [g for g in all_goldens if len(g.get("sql_query", "")) < 300]
            return short_goldens[-2:] if short_goldens else all_goldens[-2:]
        return relevant

    def _build_schema_catalog(self) -> str:
        tables = self.db.get_schema_knowledge(entity_type="table")
        if not tables:
            tables = self.db.get_schema_knowledge(entity_type="tablo_kalibi")
        if not tables:
            return ""

        lines = []
        for t in tables[:40]:
            name = t.get("code_or_name") or t.get("entity_key") or ""
            desc = (t.get("description") or "").strip()
            details = t.get("details") or {}
            cols = details.get("columns") or details.get("onemli_kolonlar") or {}
            col_str = ""
            if isinstance(cols, dict) and cols:
                col_str = ", ".join([f"{k} ({v})" if v else str(k) for k, v in list(cols.items())[:18]])
            elif isinstance(cols, list) and cols:
                col_str = ", ".join(str(c) for c in cols[:18])
            piece = f"- `{name}`: {desc}" if desc else f"- `{name}`"
            if col_str:
                piece += f"\n  Kolonlar: {col_str}"
            lines.append(piece)
        return "\n".join(lines)

    def build_system_prompt(
        self,
        user_query: Optional[str] = None,
        active_firm: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> str:
        pack = get_pack()
        firmalar = self.get_firmalar()
        firmalar_str = "\n".join(
            [
                f"- {f.get('entity_key') or f.get('code_or_name')}: {f.get('description')}"
                for f in firmalar
            ]
        )

        prefs = self.get_preferences()
        pref_items = []
        columns = prefs.get("columns") or prefs.get("kolon_isimlendirmeleri") or {}
        roles = prefs.get("roles") or prefs.get("alan_rolleri") or {}
        if columns:
            pref_items.append(
                "• Kolon İsimlendirme Tercihleri: "
                + ", ".join([f"{k} -> {v}" for k, v in columns.items()])
            )
        if roles:
            pref_items.append(
                "• Alan Rolleri: " + ", ".join([f"{k} -> {v}" for k, v in roles.items()])
            )

        notes = self.db.get_all_learned_notes()
        for n in notes:
            note = (n.get("note_text") or n.get("note") or "").strip()
            if note:
                pref_items.append(f"• {note}")

        learned_str = "\n".join(pref_items) if pref_items else "Henüz özel bir kural tanımlanmadı."

        today_str = datetime.now().strftime("%Y-%m-%d")
        month_start_str = datetime.now().strftime("%Y-%m-01")
        eff_start = start_date or month_start_str
        eff_end = end_date or today_str

        date_context = f"""
### CANLI TARİH KURALI:
- Sistemin gerçek bugünü: '{today_str}'
- Kullanıcının seçtiği başlangıç: '{eff_start}'
- Kullanıcının seçtiği bitiş: '{eff_end}'
- Kullanıcı geçmiş bir tarih belirtmedikçe güncel dönemi ({eff_end}) esas al.
"""

        relevant_goldens = self.get_relevant_golden_examples(user_query=user_query, max_examples=3)
        golden_str = ""
        if relevant_goldens:
            items = []
            for g in relevant_goldens:
                items.append(
                    f"Soru: \"{g['soru']}\"\nHedef DB: {g.get('target_database', pack.default_database)}\nSQL: {g['sql_query']}\nAçıklama: {g.get('aciklama', '')}"
                )
            golden_str = (
                "\n\n### İLGİLİ ALTIN SQL REFERANS ÖRNEKLERİ:\n" + "\n---\n".join(items)
            )

        ctx = PromptContext(
            user_query=user_query,
            active_firm=active_firm or pack.default_firm or settings.DEFAULT_FIRM or "",
            start_date=start_date,
            end_date=end_date,
            firmalar_str=firmalar_str,
            learned_str=learned_str,
            date_context=date_context,
            golden_str=golden_str,
            today_str=today_str,
            dialect=pack.dialect or settings.SQL_DIALECT,
            app_name=settings.APP_NAME,
            assistant_name=settings.ASSISTANT_NAME,
            default_database=pack.default_database or settings.DEFAULT_DATABASE or settings.MSSQL_DATABASE or "DEFAULT",
            schema_catalog=self._build_schema_catalog(),
        )

        builder = pack.build_system_prompt
        if builder:
            return builder(ctx)
        from app.packs.generic.prompt import build_system_prompt as generic_prompt
        return generic_prompt(ctx)


schema_manager = SchemaManager()
