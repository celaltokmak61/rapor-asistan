import sqlite3
import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

def _default_db_path() -> Path:
    try:
        from app.core.config import settings
        if getattr(settings, "KNOWLEDGE_DB_PATH", ""):
            return Path(settings.KNOWLEDGE_DB_PATH)
        pack_id = (getattr(settings, "ACTIVE_PACK", "") or "").lower()
        if pack_id in ("demo", "sample", "commerce"):
            return Path(__file__).resolve().parent / "demo-knowledge.db"
    except Exception:
        pass
    return Path(__file__).resolve().parent / "knowledge.db"


DB_PATH = _default_db_path()

class KnowledgeDatabase:
    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self._init_db()
        self._seed_default_data()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")  # Yüksek hız ve eşzamanlılık
        return conn

    def _init_db(self):
        """Veritabanı tablolarını oluşturur."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 1. Altın Kurallar (Golden SQL)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS golden_sql (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                soru TEXT UNIQUE NOT NULL,
                sql_query TEXT NOT NULL,
                chart_type TEXT DEFAULT 'table',
                target_database TEXT DEFAULT 'DEFAULT',
                aciklama TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 2. Kalıcı Kullanıcı Tercihleri & Stil Kuralları
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                key_name TEXT NOT NULL,
                value_content TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(category, key_name)
            );
            """)

            # 3. Şema ve İş Mantığı Bilgisi
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS schema_knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL,
                code_or_name TEXT NOT NULL,
                description TEXT NOT NULL,
                details_json TEXT,
                UNIQUE(entity_type, code_or_name)
            );
            """)

            # 4. Serbest Öğrenilmiş Notlar ve Kurallar
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS learned_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_text TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 5. Kullanıcılar ve Yetkiler
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT NOT NULL,
                role TEXT DEFAULT 'admin',
                branch_access TEXT DEFAULT 'ALL',
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # -------------------------------------------------------------
            # 🌟 YENİ NESİL KURUMSAL ZEKA & HAFIZA TABLOLARI
            # -------------------------------------------------------------

            # 6. Kalıcı Sohbet Oturumları (Multi-Model Sessions)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                user_name TEXT DEFAULT 'Yönetici',
                title TEXT DEFAULT 'Yeni Analiz Sohbeti',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 7. Kalıcı Sohbet Mesajları & Rapor Geçmişi
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL, -- 'user' | 'assistant'
                content TEXT NOT NULL,
                report_title TEXT,
                sql_executed TEXT,
                summary_data_json TEXT,
                strategic_insight TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
            );
            """)

            # 8. Kurumsal Değerler & Şirket Ahlakı (Corporate Values & DNA)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS corporate_values (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT UNIQUE NOT NULL,
                description TEXT NOT NULL,
                priority TEXT DEFAULT 'YÜKSEK', -- 'KRİTİK', 'YÜKSEK', 'ORTA'
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 9. Kurumsal İş Kuralları, Kâr Marjları ve Fire Limitleri
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS business_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL, -- 'GENEL' veya kullanıcı tanımlı kategori
                rule_name TEXT NOT NULL,
                rule_text TEXT NOT NULL,
                min_margin_pct REAL, -- Minimum brüt kâr marjı %
                max_loss_pct REAL,   -- Maksimum fire / zayiat toleransı %
                severity TEXT DEFAULT 'UYARI', -- 'BLOKE', 'KRİTİK_UYARI', 'BİLGİ'
                action_recommendation TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_business_rules_cat_name ON business_rules(category, rule_name);
            """)

            # 10. Anomali ve Kök Neden Teşhis Rehberleri (Diagnostic Playbooks)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS diagnostic_playbooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                anomaly_type TEXT UNIQUE NOT NULL, -- 'EKSI_STOK', 'SAYIM_FARKI', 'DUSUK_KAR', 'YUKSEK_FIRE'
                title TEXT NOT NULL,
                check_steps_json TEXT NOT NULL, -- ["1. İrsaliye kontrolü", "2. Virman/transfer", ...]
                root_cause_guide TEXT NOT NULL,
                action_template TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            # 11. 🤖 Dinamik Patron Yönetici Soruları (Aylık Soru Frekansı & Sabitlenenler)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS ai_frequent_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_text TEXT NOT NULL,
                chip_label TEXT,
                category TEXT DEFAULT 'Genel',
                ask_count INTEGER DEFAULT 1,
                is_pinned INTEGER DEFAULT 0,
                month_key TEXT NOT NULL,
                last_asked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(question_text, month_key)
            );
            """)

            conn.commit()

    def _seed_default_data(self):
        """Varsayılan kullanıcı, şirket değerleri ve teşhis rehberlerini yükler."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Varsayılan Kullanıcılar (admin & user)
            from app.core.config import settings

            cursor.execute("SELECT id FROM users WHERE username = ?", (settings.ADMIN_USERNAME,))
            if not cursor.fetchone():
                pwd_hash = hashlib.sha256(settings.ADMIN_PASSWORD.encode()).hexdigest()
                cursor.execute("""
                INSERT INTO users (username, password_hash, full_name, role, branch_access, is_active)
                VALUES (?, ?, ?, 'admin', 'ALL', 1)
                """, (settings.ADMIN_USERNAME, pwd_hash, settings.ADMIN_FULL_NAME))

            conn.commit()

    # -------------------------------------------------------------
    # 💬 SOHBET HAFIZASI VE OTURUM İŞLEMLERİ
    # -------------------------------------------------------------

    def get_or_create_session(self, session_id: str, user_name: str = "Yönetici") -> str:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT session_id FROM chat_sessions WHERE session_id = ?", (session_id,))
            if not cursor.fetchone():
                cursor.execute("""
                INSERT INTO chat_sessions (session_id, user_name, title, created_at, updated_at)
                VALUES (?, ?, 'Analiz Sohbeti', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, (session_id, user_name))
                conn.commit()
            return session_id

    def save_chat_message(self, session_id: str, role: str, content: str, report_title: str = None, sql_executed: str = None, summary_data: Any = None, strategic_insight: str = None) -> int:
        self.get_or_create_session(session_id)
        with self.get_connection() as conn:
            cursor = conn.cursor()
            sum_str = json.dumps(summary_data, ensure_ascii=False) if summary_data else None
            cursor.execute("""
            INSERT INTO chat_messages (session_id, role, content, report_title, sql_executed, summary_data_json, strategic_insight, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (session_id, role, content, report_title, sql_executed, sum_str, strategic_insight))
            
            cursor.execute("UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?", (session_id,))
            conn.commit()
            return cursor.lastrowid

    def get_session_history(self, session_id: str, limit: int = 15) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT * FROM chat_messages 
            WHERE session_id = ? 
            ORDER BY id ASC 
            LIMIT ?
            """, (session_id, limit))
            rows = cursor.fetchall()
            history = []
            for r in rows:
                item = dict(r)
                if item.get("summary_data_json"):
                    try:
                        item["summary_data"] = json.loads(item["summary_data_json"])
                    except Exception:
                        item["summary_data"] = None
                history.append(item)
            return history

    def clear_session_history(self, session_id: str) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            cursor.execute("DELETE FROM chat_sessions WHERE session_id = ?", (session_id,))
            conn.commit()
            return True

    # -------------------------------------------------------------
    # 🏛️ KURUMSAL DEĞERLER, İŞ KURALLARI VE TEŞHİS REHBERLERİ
    # -------------------------------------------------------------

    def add_corporate_value(self, title: str, description: str, priority: str = "YÜKSEK") -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO corporate_values (title, description, priority, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(title) DO UPDATE SET
                description=excluded.description,
                priority=excluded.priority;
            """, (title, description, priority))
            conn.commit()
            return cursor.lastrowid

    def get_active_corporate_values(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM corporate_values WHERE is_active = 1 ORDER BY id ASC")
            return [dict(r) for r in cursor.fetchall()]

    def delete_corporate_value(self, val_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM corporate_values WHERE id = ?", (val_id,))
            conn.commit()
            return cursor.rowcount > 0

    def add_business_rule(self, category: str, rule_name: str, rule_text: str, min_margin: Optional[float] = None, max_loss: Optional[float] = None, severity: str = "UYARI", action_recommendation: str = "") -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM business_rules WHERE category = ? AND rule_name = ?", (category, rule_name))
            existing = cursor.fetchone()
            if existing:
                cursor.execute("""
                UPDATE business_rules
                SET rule_text = ?, min_margin_pct = ?, max_loss_pct = ?, severity = ?, action_recommendation = ?, is_active = 1
                WHERE id = ?
                """, (rule_text, min_margin, max_loss, severity, action_recommendation, existing['id']))
                conn.commit()
                return existing['id']

            cursor.execute("""
            INSERT INTO business_rules (category, rule_name, rule_text, min_margin_pct, max_loss_pct, severity, action_recommendation, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """, (category, rule_name, rule_text, min_margin, max_loss, severity, action_recommendation))
            conn.commit()
            return cursor.lastrowid

    def get_active_business_rules(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if category:
                cursor.execute("SELECT * FROM business_rules WHERE is_active = 1 AND (category = ? OR category = 'GENEL') ORDER BY id ASC", (category,))
            else:
                cursor.execute("SELECT * FROM business_rules WHERE is_active = 1 ORDER BY id ASC")
            return [dict(r) for r in cursor.fetchall()]

    def delete_business_rule(self, rule_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM business_rules WHERE id = ?", (rule_id,))
            conn.commit()
            return cursor.rowcount > 0

    def add_diagnostic_playbook(self, anomaly_type: str, title: str, check_steps: List[str], root_cause_guide: str, action_template: str) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            steps_str = json.dumps(check_steps, ensure_ascii=False)
            cursor.execute("""
            INSERT INTO diagnostic_playbooks (anomaly_type, title, check_steps_json, root_cause_guide, action_template, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(anomaly_type) DO UPDATE SET
                title=excluded.title,
                check_steps_json=excluded.check_steps_json,
                root_cause_guide=excluded.root_cause_guide,
                action_template=excluded.action_template;
            """, (anomaly_type, title, steps_str, root_cause_guide, action_template))
            conn.commit()
            return cursor.lastrowid

    def get_active_diagnostic_playbooks(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM diagnostic_playbooks WHERE is_active = 1 ORDER BY id ASC")
            rows = cursor.fetchall()
            result = []
            for r in rows:
                item = dict(r)
                if item.get("check_steps_json"):
                    try:
                        item["check_steps"] = json.loads(item["check_steps_json"])
                    except Exception:
                        item["check_steps"] = []
                result.append(item)
            return result

    def delete_diagnostic_playbook(self, pb_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM diagnostic_playbooks WHERE id = ?", (pb_id,))
            conn.commit()
            return cursor.rowcount > 0

    # -------------------------------------------------------------
    # 👥 KULLANICI İŞLEMLERİ (AUTH / RBAC)
    # -------------------------------------------------------------

    def create_user(self, username: str, password_raw: str, full_name: str, role: str = "user", branch_access: str = "ALL") -> Dict[str, Any]:
        role = "admin" if role.lower().strip() == "admin" else "user"
        pwd_hash = hashlib.sha256(password_raw.encode()).hexdigest()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO users (username, password_hash, full_name, role, branch_access, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
            """, (username, pwd_hash, full_name, role, branch_access))
            conn.commit()
            return {"success": True, "id": cursor.lastrowid, "username": username, "role": role}

    def authenticate_user(self, username: str, password_raw: str) -> Optional[Dict[str, Any]]:
        pwd_hash = hashlib.sha256(password_raw.encode()).hexdigest()
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ? AND password_hash = ? AND is_active = 1", (username, pwd_hash))
            row = cursor.fetchone()
            if row:
                return dict(row)
            return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, username, full_name, role, branch_access, is_active, created_at FROM users ORDER BY id ASC")
            return [dict(r) for r in cursor.fetchall()]

    def update_user(self, user_id: int, full_name: Optional[str] = None, password_raw: Optional[str] = None, role: Optional[str] = None) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            updates = []
            params = []

            if full_name is not None and full_name.strip():
                updates.append("full_name = ?")
                params.append(full_name.strip())

            if password_raw is not None and password_raw.strip():
                pwd_hash = hashlib.sha256(password_raw.strip().encode()).hexdigest()
                updates.append("password_hash = ?")
                params.append(pwd_hash)

            if role is not None and role.strip():
                clean_role = "admin" if role.lower().strip() == "admin" else "user"
                updates.append("role = ?")
                params.append(clean_role)

            if not updates:
                return True

            params.append(user_id)
            sql = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(sql, tuple(params))
            conn.commit()
            return cursor.rowcount > 0

    def delete_user(self, user_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM users WHERE id = ? AND username != 'admin'", (user_id,))
            conn.commit()
            return cursor.rowcount > 0

    # -------------------------------------------------------------
    # 🏆 GOLDEN SQL & KURALLAR
    # -------------------------------------------------------------

    def add_golden_sql(self, soru: str, sql_query: str, chart_type: str = "table", target_db: str = "DEFAULT", aciklama: str = "") -> str:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO golden_sql (soru, sql_query, chart_type, target_database, aciklama, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(soru) DO UPDATE SET
                sql_query=excluded.sql_query,
                chart_type=excluded.chart_type,
                target_database=excluded.target_database,
                aciklama=excluded.aciklama,
                created_at=CURRENT_TIMESTAMP;
            """, (soru, sql_query, chart_type, target_db, aciklama))
            conn.commit()
            return "Altın SQL kuralı SQLite veritabanına başarıyla kaydedildi."

    def update_golden_sql(self, golden_id: int, soru: str, sql_query: str, chart_type: str = "table", target_db: str = "DEFAULT", aciklama: str = "") -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE golden_sql 
            SET soru = ?, sql_query = ?, chart_type = ?, target_database = ?, aciklama = ?, created_at = CURRENT_TIMESTAMP
            WHERE id = ?;
            """, (soru, sql_query, chart_type, target_db, aciklama, golden_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_golden_sql_by_id(self, golden_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM golden_sql WHERE id = ?", (golden_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def find_similar_golden_sql(self, query_text: str, sql_query: str = "", threshold: float = 0.45) -> List[Dict[str, Any]]:
        """
        Kelimelerin kökleri, n-gramları ve SQL tablo benzerliği üzerinden çakışan veya benzer Altın Sorguları tespit eder.
        """
        all_goldens = self.get_all_golden_sql()
        if not all_goldens or not query_text:
            return []

        def tokenize(text: str) -> set:
            if not text:
                return set()
            clean = text.lower().replace("'", " ").replace('"', ' ').replace(".", " ").replace(",", " ")
            return {w for w in clean.split() if len(w) > 2 and w not in {'select', 'from', 'where', 'and', 'join', 'with', 'nolock', 'group', 'order', 'left', 'inner'}}

        q_tokens = tokenize(query_text)
        sql_tokens = tokenize(sql_query) if sql_query else set()

        matches = []
        for g in all_goldens:
            g_soru_tokens = tokenize(g.get("soru", ""))
            g_desc_tokens = tokenize(g.get("aciklama", ""))
            g_sql_tokens = tokenize(g.get("sql_query", ""))

            # Başlık / Soru Jaccard Benzerliği
            combined_target_tokens = g_soru_tokens.union(g_desc_tokens)
            inter = len(q_tokens.intersection(combined_target_tokens))
            union = len(q_tokens.union(combined_target_tokens))
            text_sim = (inter / union) if union > 0 else 0.0

            # SQL Tablo ve Mantık Benzerliği
            sql_sim = 0.0
            if sql_tokens and g_sql_tokens:
                sql_inter = len(sql_tokens.intersection(g_sql_tokens))
                sql_union = len(sql_tokens.union(g_sql_tokens))
                sql_sim = (sql_inter / sql_union) if sql_union > 0 else 0.0

            # Ağırlıklı Toplam Skor
            total_score = (text_sim * 0.65) + (sql_sim * 0.35)
            
            if total_score >= threshold:
                item = dict(g)
                item["similarity_score"] = round(total_score, 2)
                matches.append(item)

        matches.sort(key=lambda x: x["similarity_score"], reverse=True)
        return matches

    def delete_golden_sql(self, golden_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM golden_sql WHERE id = ?", (golden_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_all_golden_sql(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM golden_sql ORDER BY id DESC")
            return [dict(row) for row in cursor.fetchall()]

    # -------------------------------------------------------------
    # ⚙️ KULLANICI TERCİHLERİ & ÖĞRENİLMİŞ NOTLAR
    # -------------------------------------------------------------

    def get_preference(self, category: str, key_name: str, default: Optional[str] = None) -> Optional[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT value_content FROM user_preferences WHERE category = ? AND key_name = ?",
                (category, key_name),
            )
            row = cursor.fetchone()
            if not row:
                return default
            return row["value_content"]

    def save_preference(self, category: str, key_name: str, value_content: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO user_preferences (category, key_name, value_content, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(category, key_name) DO UPDATE SET
                value_content=excluded.value_content,
                updated_at=CURRENT_TIMESTAMP;
            """, (category, key_name, value_content))
            conn.commit()

    def get_all_preferences(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT category, key_name, value_content FROM user_preferences")
            result = {
                "kolon_isimlendirmeleri": {},
                "alan_rolleri": {},
                "varsayilan_filtreler": {},
                "ozel_davranis_kurallari": []
            }
            for row in cursor.fetchall():
                cat = row["category"]
                k = row["key_name"]
                v = row["value_content"]
                if cat == "ozel_davranis_kurallari":
                    result["ozel_davranis_kurallari"].append(v)
                elif cat in result:
                    result[cat][k] = v
                else:
                    result[cat] = {k: v}
            return result

    def add_learned_note(self, note_text: str):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT OR IGNORE INTO learned_notes (note_text) VALUES (?);
            """, (note_text.strip(),))
            conn.commit()

    def delete_learned_note(self, note_id: int) -> bool:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM learned_notes WHERE id = ?", (note_id,))
            conn.commit()
            return cursor.rowcount > 0

    def get_all_learned_notes(self) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, note_text, created_at FROM learned_notes ORDER BY id ASC")
            return [dict(r) for r in cursor.fetchall()]

    def save_schema_knowledge(self, entity_type: str, code_or_name: str, description: str, details: Optional[Dict[str, Any]] = None):
        with self.get_connection() as conn:
            cursor = conn.cursor()
            details_str = json.dumps(details, ensure_ascii=False) if details else None
            cursor.execute("""
            INSERT INTO schema_knowledge (entity_type, code_or_name, description, details_json)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(entity_type, code_or_name) DO UPDATE SET
                description=excluded.description,
                details_json=excluded.details_json;
            """, (entity_type, code_or_name, description, details_str))
            conn.commit()

    def get_schema_knowledge(self, entity_type: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            if entity_type:
                cursor.execute("SELECT * FROM schema_knowledge WHERE entity_type = ? ORDER BY id ASC", (entity_type,))
            else:
                cursor.execute("SELECT * FROM schema_knowledge ORDER BY id ASC")
            rows = cursor.fetchall()
            result = []
            for r in rows:
                item = dict(r)
                if item.get("details_json"):
                    try:
                        item["details"] = json.loads(item["details_json"])
                    except Exception:
                        item["details"] = item["details_json"]
                result.append(item)
            return result

    # =========================================================================
    # 🤖 DİNAMİK PATRON YÖNETİCİ SORULARI YÖNETİMİ
    # =========================================================================
    def record_question(self, question_text: str, category: str = "Genel") -> None:
        """Kullanıcının/patronun sorduğu soruyu aylık frekans tablosuna işler."""
        if not question_text or len(question_text.strip()) < 4:
            return
        
        q_clean = question_text.strip()
        month_key = datetime.now().strftime("%Y-%m")
        chip_label = q_clean[:22] + "..." if len(q_clean) > 22 else q_clean

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO ai_frequent_questions (question_text, chip_label, category, ask_count, is_pinned, month_key, last_asked_at)
            VALUES (?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(question_text, month_key) DO UPDATE SET
                ask_count = ask_count + 1,
                last_asked_at = CURRENT_TIMESTAMP;
            """, (q_clean, chip_label, category, month_key))
            conn.commit()

    def get_dynamic_preset_questions(self, limit: int = 6) -> List[Dict[str, Any]]:
        """
        Öncelikle sabitlenmiş (yıldızlanmış) soruları, ardından bu ay en çok sorulan soruları döner.
        """
        month_key = datetime.now().strftime("%Y-%m")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, question_text, chip_label, category, ask_count, is_pinned, last_asked_at
            FROM ai_frequent_questions
            WHERE is_pinned = 1 OR month_key = ?
            ORDER BY is_pinned DESC, ask_count DESC, last_asked_at DESC
            LIMIT ?;
            """, (month_key, limit))
            rows = cursor.fetchall()
            
            if rows:
                result = []
                for r in rows:
                    d = dict(r)
                    d["question"] = d.get("question_text", "")
                    result.append(d)
                return result
            
            return [
                {"id": 0, "question_text": "Bugünün satış özetini getir", "question": "Bugünün satış özetini getir", "chip_label": "Günlük Satış", "category": "Satış", "is_pinned": 1},
                {"id": 0, "question_text": "Eksiye düşen stokları listele", "question": "Eksiye düşen stokları listele", "chip_label": "Eksi Stok", "category": "Stok", "is_pinned": 1},
                {"id": 0, "question_text": "Bu ayın ciro karşılaştırmasını göster", "question": "Bu ayın ciro karşılaştırmasını göster", "chip_label": "Aylık Ciro", "category": "Satış", "is_pinned": 0},
            ]

    def toggle_pin_question(self, question_text: str, pinned: Optional[int] = None) -> bool:
        """Bir soruyu sabitlenen çip olarak işaretler veya kaldırır."""
        month_key = datetime.now().strftime("%Y-%m")
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, is_pinned FROM ai_frequent_questions WHERE question_text = ?", (question_text.strip(),))
            row = cursor.fetchone()
            if row:
                if pinned is not None:
                    new_state = 1 if pinned else 0
                else:
                    new_state = 0 if row["is_pinned"] == 1 else 1
                cursor.execute("UPDATE ai_frequent_questions SET is_pinned = ? WHERE question_text = ?", (new_state, question_text.strip()))
                conn.commit()
                return bool(new_state)
            else:
                new_state = 1 if (pinned is None or pinned) else 0
                chip_label = question_text.strip()[:22] + "..." if len(question_text.strip()) > 22 else question_text.strip()
                cursor.execute("""
                INSERT INTO ai_frequent_questions (question_text, chip_label, category, ask_count, is_pinned, month_key)
                VALUES (?, ?, 'Yönetici', 1, ?, ?);
                """, (question_text.strip(), chip_label, new_state, month_key))
                conn.commit()
                return bool(new_state)

    def get_all_frequent_questions(self) -> List[Dict[str, Any]]:
        """Admin paneli için tüm önerilen ve sık sorulan soruları döner."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            SELECT id, question_text, chip_label, category, ask_count, is_pinned, month_key, last_asked_at
            FROM ai_frequent_questions
            ORDER BY is_pinned DESC, ask_count DESC, id DESC;
            """)
            rows = cursor.fetchall()
            if rows:
                return [dict(r) for r in rows]
            
            month_key = datetime.now().strftime("%Y-%m")
            default_presets = [
                ("Bugünün satış özetini getir", "Günlük Satış", "Satış", 1, 1),
                ("Eksiye düşen stokları listele", "Eksi Stok", "Stok", 1, 1),
                ("Bu ayın ciro karşılaştırmasını göster", "Aylık Ciro", "Satış", 1, 0),
            ]
            for q_text, c_lbl, cat, cnt, pinned in default_presets:
                cursor.execute("""
                INSERT OR IGNORE INTO ai_frequent_questions (question_text, chip_label, category, ask_count, is_pinned, month_key)
                VALUES (?, ?, ?, ?, ?, ?);
                """, (q_text, c_lbl, cat, cnt, pinned, month_key))
            conn.commit()
            
            cursor.execute("""
            SELECT id, question_text, chip_label, category, ask_count, is_pinned, month_key, last_asked_at
            FROM ai_frequent_questions
            ORDER BY is_pinned DESC, ask_count DESC, id DESC;
            """)
            return [dict(r) for r in cursor.fetchall()]

    def add_frequent_question(self, question_text: str, chip_label: Optional[str] = None, category: str = "Genel", is_pinned: int = 0, ask_count: int = 1) -> int:
        """Yeni bir soru önerisi ekler."""
        q_clean = question_text.strip()
        month_key = datetime.now().strftime("%Y-%m")
        label = chip_label.strip() if chip_label and chip_label.strip() else (q_clean[:22] + "..." if len(q_clean) > 22 else q_clean)
        pinned = 1 if is_pinned else 0
        count = max(1, int(ask_count or 1))
        cat = category.strip() if category else "Genel"

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO ai_frequent_questions (question_text, chip_label, category, ask_count, is_pinned, month_key, last_asked_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(question_text, month_key) DO UPDATE SET
                chip_label = excluded.chip_label,
                category = excluded.category,
                ask_count = excluded.ask_count,
                is_pinned = excluded.is_pinned,
                last_asked_at = CURRENT_TIMESTAMP;
            """, (q_clean, label, cat, count, pinned, month_key))
            conn.commit()
            return cursor.lastrowid

    def update_frequent_question(self, q_id: int, question_text: str, chip_label: Optional[str] = None, category: str = "Genel", is_pinned: int = 0, ask_count: int = 1) -> bool:
        """Mevcut soru önerisini günceller."""
        q_clean = question_text.strip()
        label = chip_label.strip() if chip_label and chip_label.strip() else (q_clean[:22] + "..." if len(q_clean) > 22 else q_clean)
        pinned = 1 if is_pinned else 0
        count = max(1, int(ask_count or 1))
        cat = category.strip() if category else "Genel"

        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
            UPDATE ai_frequent_questions
            SET question_text = ?, chip_label = ?, category = ?, is_pinned = ?, ask_count = ?, last_asked_at = CURRENT_TIMESTAMP
            WHERE id = ?;
            """, (q_clean, label, cat, pinned, count, q_id))
            conn.commit()
            return cursor.rowcount > 0

    def delete_frequent_question(self, q_id: int) -> bool:
        """Bir soru önerisini siler."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM ai_frequent_questions WHERE id = ?;", (q_id,))
            conn.commit()
            return cursor.rowcount > 0

    def toggle_pin_by_id(self, q_id: int) -> bool:
        """ID üzerinden pin durumunu tersine çevirir."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT is_pinned FROM ai_frequent_questions WHERE id = ?;", (q_id,))
            row = cursor.fetchone()
            if not row:
                return False
            new_state = 0 if row["is_pinned"] == 1 else 1
            cursor.execute("UPDATE ai_frequent_questions SET is_pinned = ? WHERE id = ?;", (new_state, q_id))
            conn.commit()
            return bool(new_state)

knowledge_db = KnowledgeDatabase()

